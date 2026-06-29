const express = require('express');
const Order = require('../models/Order');
const AssignmentLog = require('../models/AssignmentLog');
const { protect, authorize } = require('../middleware/auth');
const {
  isValidTransition,
  canCancel,
} = require('../services/orderTransitions');
const { autoAssign } = require('../services/assignmentEngine');

const router = express.Router();

router.use(protect);
router.use(authorize('rider'));

// GET /api/v1/orders -- rider's orders (current + past)
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find({ assignedRiderId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/v1/orders/:id -- single order detail
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (String(order.assignedRiderId) !== String(req.user._id)) {
      return res
        .status(403)
        .json({ error: 'Not authorized to view this order' });
    }

    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// PATCH /api/v1/orders/:id/accept
router.patch('/:id/accept', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (String(order.assignedRiderId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Order was reassigned' });
    }

    if (order.status === 'accepted') {
      return res.json({ order });
    }

    if (!isValidTransition(order.status, 'accepted')) {
      return res
        .status(400)
        .json({ error: `Cannot accept order in '${order.status}' status` });
    }

    if (order.acceptTimeoutAt && order.acceptTimeoutAt < new Date()) {
      return res.status(400).json({ error: 'Accept window has expired' });
    }

    order.status = 'accepted';
    order.acceptedAt = new Date();
    await order.save();

    await AssignmentLog.create({
      orderId: order._id,
      riderId: req.user._id,
      action: 'accepted',
      performedBy: req.user._id,
    });

    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept order' });
  }
});

// PATCH /api/v1/orders/:id/decline
router.patch('/:id/decline', async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (String(order.assignedRiderId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not assigned to this order' });
    }

    if (order.status !== 'assigned') {
      return res
        .status(400)
        .json({ error: `Cannot decline order in '${order.status}' status` });
    }

    await AssignmentLog.create({
      orderId: order._id,
      riderId: req.user._id,
      action: 'declined',
      reason: reason || null,
      performedBy: req.user._id,
    });

    order.status = 'pending_assignment';
    order.assignedRiderId = null;
    order.assignedAt = null;
    order.acceptTimeoutAt = null;
    order.declineReason = reason || null;
    await order.save();

    // Auto-reassign: exclude all riders who already declined this order
    const previousDeclines = await AssignmentLog.find({
      orderId: order._id,
      action: { $in: ['declined', 'timeout'] },
    }).distinct('riderId');

    const reassigned = await autoAssign(order._id, previousDeclines);

    res.json({
      message: 'Order declined',
      order,
      reassignedTo: reassigned ? reassigned.name : null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to decline order' });
  }
});

// PATCH /api/v1/orders/:id/pickup
router.patch('/:id/pickup', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (String(order.assignedRiderId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not assigned to this order' });
    }

    if (order.status === 'picked_up') {
      return res.json({ order });
    }

    if (!isValidTransition(order.status, 'picked_up')) {
      return res
        .status(400)
        .json({
          error: `Cannot mark pickup from '${order.status}' status`,
        });
    }

    order.status = 'picked_up';
    order.pickedUpAt = new Date();
    await order.save();

    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark pickup' });
  }
});

// PATCH /api/v1/orders/:id/deliver
router.patch('/:id/deliver', async (req, res) => {
  try {
    const { proofPhotoUrl, riderDeliveryNotes, cashCollected } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (String(order.assignedRiderId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not assigned to this order' });
    }

    if (order.status === 'delivered') {
      return res.json({ order });
    }

    if (!isValidTransition(order.status, 'delivered')) {
      return res
        .status(400)
        .json({
          error: `Cannot deliver from '${order.status}' status`,
        });
    }

    // I10: COD orders require cash confirmation
    if (order.paymentMethod === 'cod' && cashCollected !== true) {
      return res
        .status(400)
        .json({ error: 'Cash collection must be confirmed for COD orders' });
    }

    order.status = 'delivered';
    order.deliveredAt = new Date();
    order.proofPhotoUrl = proofPhotoUrl || null;
    order.riderDeliveryNotes = riderDeliveryNotes || null;
    order.cashCollected = order.paymentMethod === 'cod' ? true : null;
    await order.save();

    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark delivery' });
  }
});

// PATCH /api/v1/orders/:id/cancel -- rider cancels (before pickup only, reason required)
router.patch('/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res
        .status(400)
        .json({ error: 'Reason is required when rider cancels' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (String(order.assignedRiderId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not assigned to this order' });
    }

    if (!canCancel(order.status)) {
      return res
        .status(400)
        .json({ error: `Cannot cancel order in '${order.status}' status` });
    }

    // Rider can only cancel if they've accepted (not just assigned)
    if (order.status === 'assigned') {
      return res
        .status(400)
        .json({ error: 'Decline the order instead of cancelling' });
    }

    await AssignmentLog.create({
      orderId: order._id,
      riderId: req.user._id,
      action: 'cancelled',
      reason,
      performedBy: req.user._id,
    });

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelledBy = 'rider';
    order.cancelReason = reason;
    await order.save();

    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

module.exports = router;
