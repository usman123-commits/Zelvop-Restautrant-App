const express = require('express');
const Order = require('../models/Order');
const User = require('../models/User');
const AssignmentLog = require('../models/AssignmentLog');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const generateOrderId = require('../utils/orderIdGenerator');
const {
  ACCEPT_TIMEOUT_MS,
  canCancel,
} = require('../services/orderTransitions');
const { autoAssign } = require('../services/assignmentEngine');

const router = express.Router();

router.use(protect);
router.use(authorize('owner'));

// POST /api/v1/owner/orders -- create a new order
router.post('/orders', async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryNotes,
      items,
      paymentMethod,
      source,
    } = req.body;

    if (!customerName || !customerPhone || !deliveryAddress) {
      return res.status(400).json({
        error: 'customerName, customerPhone, and deliveryAddress are required',
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: 'At least one item is required' });
    }

    if (!['cod', 'prepaid'].includes(paymentMethod)) {
      return res
        .status(400)
        .json({ error: 'paymentMethod must be cod or prepaid' });
    }

    // Dedup: reject if same customerPhone + createdAt within 60 seconds
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const duplicate = await Order.findOne({
      customerPhone,
      createdAt: { $gte: oneMinuteAgo },
    });
    if (duplicate) {
      return res
        .status(409)
        .json({ error: 'Duplicate order detected', orderId: duplicate.orderId });
    }

    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const orderId = await generateOrderId();

    const order = await Order.create({
      orderId,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryNotes: deliveryNotes || null,
      items,
      totalAmount,
      paymentMethod,
      source: source || 'dashboard',
      createdBy: req.user._id,
      status: 'pending_assignment',
    });

    const assignedRider = await autoAssign(order._id);

    const freshOrder = await Order.findById(order._id)
      .populate('assignedRiderId', 'name contactNumber')
      .lean();

    res.status(201).json({
      order: freshOrder,
      autoAssigned: assignedRider ? assignedRider.name : null,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET /api/v1/owner/orders -- all orders
router.get('/orders', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('assignedRiderId', 'name contactNumber')
        .sort({ createdAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit))
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({ orders, total, hasMore: Number(offset) + orders.length < total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/v1/owner/orders/:id -- single order detail
router.get('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('assignedRiderId', 'name contactNumber isOnline')
      .lean();

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// PATCH /api/v1/owner/orders/:id/assign -- manual assign or reassign
router.patch('/orders/:id/assign', async (req, res) => {
  try {
    const { riderId } = req.body;
    if (!riderId) {
      return res.status(400).json({ error: 'riderId is required' });
    }

    const rider = await User.findById(riderId);
    if (!rider || rider.role !== 'rider') {
      return res.status(400).json({ error: 'Invalid rider' });
    }

    // I2: Check rider doesn't have an active order
    const activeOrder = await Order.findOne({
      assignedRiderId: riderId,
      status: { $in: ['assigned', 'accepted', 'picked_up'] },
      _id: { $ne: req.params.id },
    });
    if (activeOrder) {
      return res
        .status(400)
        .json({ error: 'Rider already has an active order' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Can only assign/reassign before pickup
    if (!['pending_assignment', 'assigned', 'accepted'].includes(order.status)) {
      return res
        .status(400)
        .json({ error: `Cannot assign order in '${order.status}' status` });
    }

    // Log reassignment if there was a previous rider
    if (order.assignedRiderId) {
      await AssignmentLog.create({
        orderId: order._id,
        riderId: order.assignedRiderId,
        action: 'reassigned_away',
        performedBy: req.user._id,
      });
    }

    const now = new Date();
    order.assignedRiderId = riderId;
    order.assignedAt = now;
    order.acceptTimeoutAt = new Date(now.getTime() + ACCEPT_TIMEOUT_MS);
    order.acceptedAt = null;
    order.status = 'assigned';
    await order.save();

    await AssignmentLog.create({
      orderId: order._id,
      riderId: riderId,
      action: 'assigned',
      performedBy: req.user._id,
    });

    await Notification.create({
      userId: riderId,
      type: 'new_order',
      title: 'New Order Assigned',
      body: `Order ${order.orderId} has been assigned to you. Accept within 3 minutes.`,
      orderId: order._id,
    });

    const populated = await Order.findById(order._id)
      .populate('assignedRiderId', 'name contactNumber')
      .lean();

    res.json({ order: populated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign order' });
  }
});

// PATCH /api/v1/owner/orders/:id/cancel -- owner cancels
router.patch('/orders/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!canCancel(order.status)) {
      return res
        .status(400)
        .json({ error: `Cannot cancel order in '${order.status}' status` });
    }

    if (order.assignedRiderId) {
      await AssignmentLog.create({
        orderId: order._id,
        riderId: order.assignedRiderId,
        action: 'cancelled',
        reason: reason || 'Cancelled by owner',
        performedBy: req.user._id,
      });
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelledBy = 'owner';
    order.cancelReason = reason || null;
    await order.save();

    if (order.assignedRiderId) {
      await Notification.create({
        userId: order.assignedRiderId,
        type: 'order_cancelled',
        title: 'Order Cancelled',
        body: `Order ${order.orderId} has been cancelled by the owner.`,
        orderId: order._id,
      });
    }

    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// GET /api/v1/owner/riders -- list all riders with status
router.get('/riders', async (req, res) => {
  try {
    const riders = await User.find({ role: 'rider' })
      .select('name email contactNumber isOnline lastOnlineAt')
      .lean();

    // For each rider, check if they have an active order
    const riderIds = riders.map((r) => r._id);
    const activeOrders = await Order.find({
      assignedRiderId: { $in: riderIds },
      status: { $in: ['assigned', 'accepted', 'picked_up'] },
    })
      .select('assignedRiderId orderId status')
      .lean();

    const activeOrderMap = {};
    activeOrders.forEach((o) => {
      activeOrderMap[String(o.assignedRiderId)] = {
        orderId: o.orderId,
        status: o.status,
      };
    });

    const result = riders.map((r) => ({
      ...r,
      activeOrder: activeOrderMap[String(r._id)] || null,
    }));

    res.json({ riders: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch riders' });
  }
});

// GET /api/v1/owner/orders/:id/history -- assignment log for an order
router.get('/orders/:id/history', async (req, res) => {
  try {
    const logs = await AssignmentLog.find({ orderId: req.params.id })
      .populate('riderId', 'name')
      .populate('performedBy', 'name')
      .sort({ createdAt: 1 })
      .lean();

    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
