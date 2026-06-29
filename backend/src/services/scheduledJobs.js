const Order = require('../models/Order');
const User = require('../models/User');
const AssignmentLog = require('../models/AssignmentLog');
const Notification = require('../models/Notification');
const { autoAssign } = require('./assignmentEngine');

const STALE_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes

async function checkAcceptTimeouts() {
  const now = new Date();

  const timedOutOrders = await Order.find({
    status: 'assigned',
    acceptTimeoutAt: { $lte: now },
  });

  for (const order of timedOutOrders) {
    const previousRiderId = order.assignedRiderId;

    await AssignmentLog.create({
      orderId: order._id,
      riderId: previousRiderId,
      action: 'timeout',
      reason: 'Accept window expired (3 min)',
      performedBy: null,
    });

    await Notification.create({
      userId: previousRiderId,
      type: 'timeout_decline',
      title: 'Order Timed Out',
      body: `Order ${order.orderId} was reassigned because you did not respond in time.`,
      orderId: order._id,
    });

    order.status = 'pending_assignment';
    order.assignedRiderId = null;
    order.assignedAt = null;
    order.acceptTimeoutAt = null;
    await order.save();

    // Collect all riders who already declined or timed out on this order
    const previousLogs = await AssignmentLog.find({
      orderId: order._id,
      action: { $in: ['declined', 'timeout'] },
    }).distinct('riderId');

    const assigned = await autoAssign(order._id, previousLogs);

    if (!assigned) {
      const owners = await User.find({ role: 'owner' }).select('_id').lean();
      for (const owner of owners) {
        await Notification.create({
          userId: owner._id,
          type: 'stale_warning',
          title: 'No Riders Available',
          body: `Order ${order.orderId} could not be auto-assigned. All riders are busy or offline. Manual assignment needed.`,
          orderId: order._id,
        });
      }
    }

    console.log(
      `[timeout] Order ${order.orderId}: timed out rider ${previousRiderId}` +
        (assigned ? `, reassigned to ${assigned.name}` : ', no rider available')
    );
  }

  return timedOutOrders.length;
}

async function checkStaleAccepted() {
  const threshold = new Date(Date.now() - STALE_THRESHOLD_MS);

  const staleOrders = await Order.find({
    status: 'accepted',
    acceptedAt: { $lte: threshold },
  }).populate('assignedRiderId', 'name');

  const owners = await User.find({ role: 'owner' }).select('_id').lean();

  for (const order of staleOrders) {
    // Only notify once per stale event
    const existing = await Notification.findOne({
      orderId: order._id,
      type: 'stale_warning',
      title: 'Stale Order Warning',
    });
    if (existing) continue;

    const riderName = order.assignedRiderId?.name || 'Unknown';

    for (const owner of owners) {
      await Notification.create({
        userId: owner._id,
        type: 'stale_warning',
        title: 'Stale Order Warning',
        body: `${riderName} accepted ${order.orderId} over 20 minutes ago but hasn't picked up yet.`,
        orderId: order._id,
      });
    }

    console.log(`[stale] Order ${order.orderId}: accepted by ${riderName} but not picked up`);
  }

  return staleOrders.length;
}

let timeoutInterval = null;
let staleInterval = null;

function startScheduledJobs() {
  // Check accept timeouts every 30 seconds
  timeoutInterval = setInterval(async () => {
    try {
      await checkAcceptTimeouts();
    } catch (err) {
      console.error('[timeout-checker] Error:', err.message);
    }
  }, 30 * 1000);

  // Check stale accepted orders every 60 seconds
  staleInterval = setInterval(async () => {
    try {
      await checkStaleAccepted();
    } catch (err) {
      console.error('[stale-checker] Error:', err.message);
    }
  }, 60 * 1000);

  console.log('[scheduler] Accept timeout checker running (every 30s)');
  console.log('[scheduler] Stale accepted checker running (every 60s)');
}

function stopScheduledJobs() {
  if (timeoutInterval) clearInterval(timeoutInterval);
  if (staleInterval) clearInterval(staleInterval);
}

module.exports = {
  checkAcceptTimeouts,
  checkStaleAccepted,
  startScheduledJobs,
  stopScheduledJobs,
};
