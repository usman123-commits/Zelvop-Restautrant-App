const Order = require('../models/Order');
const User = require('../models/User');
const AssignmentLog = require('../models/AssignmentLog');
const Notification = require('../models/Notification');
const { ACCEPT_TIMEOUT_MS } = require('./orderTransitions');

async function findBestRider(excludeRiderIds = []) {
  const onlineRiders = await User.find({
    role: 'rider',
    isOnline: true,
    _id: { $nin: excludeRiderIds },
  })
    .select('_id name assignmentCount')
    .lean();

  if (onlineRiders.length === 0) return null;

  const riderIds = onlineRiders.map((r) => r._id);
  const busyRiders = await Order.distinct('assignedRiderId', {
    assignedRiderId: { $in: riderIds },
    status: { $in: ['assigned', 'accepted', 'picked_up'] },
  });

  const busySet = new Set(busyRiders.map(String));
  const available = onlineRiders.filter((r) => !busySet.has(String(r._id)));

  if (available.length === 0) return null;

  // Lowest assignmentCount wins (load balancing)
  available.sort((a, b) => (a.assignmentCount || 0) - (b.assignmentCount || 0));
  return available[0];
}

async function autoAssign(orderId, excludeRiderIds = []) {
  const order = await Order.findById(orderId);
  if (!order || order.status !== 'pending_assignment') return null;

  const rider = await findBestRider(excludeRiderIds);
  if (!rider) return null;

  const now = new Date();
  order.assignedRiderId = rider._id;
  order.assignedAt = now;
  order.acceptTimeoutAt = new Date(now.getTime() + ACCEPT_TIMEOUT_MS);
  order.status = 'assigned';
  await order.save();

  await AssignmentLog.create({
    orderId: order._id,
    riderId: rider._id,
    action: 'assigned',
    reason: 'auto-assignment',
    performedBy: null,
  });

  await User.updateOne(
    { _id: rider._id },
    { $inc: { assignmentCount: 1 } }
  );

  await Notification.create({
    userId: rider._id,
    type: 'new_order',
    title: 'New Order',
    body: `Order ${order.orderId} assigned to you. Accept within 3 minutes.`,
    orderId: order._id,
  });

  return rider;
}

module.exports = { findBestRider, autoAssign };
