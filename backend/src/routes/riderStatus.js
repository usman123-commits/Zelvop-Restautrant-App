const express = require('express');
const Order = require('../models/Order');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('rider'));

// PATCH /api/v1/riders/me/status -- toggle online/offline
router.patch('/me/status', async (req, res) => {
  try {
    const { isOnline } = req.body;
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ error: 'isOnline must be a boolean' });
    }

    const update = { isOnline };
    if (isOnline) {
      update.lastOnlineAt = new Date();
    }

    const user = await User.findByIdAndUpdate(req.user._id, update, {
      new: true,
    });

    if (isOnline) {
      await Notification.create({
        userId: req.user._id,
        type: 'online_status',
        title: "You're now online",
        body: 'You will receive new order assignments',
      });
    }

    res.json({
      isOnline: user.isOnline,
      lastOnlineAt: user.lastOnlineAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// GET /api/v1/riders/me/stats -- today's stats
router.get('/me/stats', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const riderId = req.user._id;

    const [todayDeliveries, activeOrder, totalAssigned, totalAccepted] =
      await Promise.all([
        Order.countDocuments({
          assignedRiderId: riderId,
          status: 'delivered',
          deliveredAt: { $gte: todayStart },
        }),
        Order.findOne({
          assignedRiderId: riderId,
          status: { $in: ['assigned', 'accepted', 'picked_up'] },
        }).lean(),
        Order.countDocuments({
          assignedRiderId: riderId,
          createdAt: { $gte: todayStart },
        }),
        Order.countDocuments({
          assignedRiderId: riderId,
          status: { $nin: ['pending_assignment'] },
          acceptedAt: { $ne: null },
          createdAt: { $gte: todayStart },
        }),
      ]);

    const acceptanceRate =
      totalAssigned > 0
        ? Math.round((totalAccepted / totalAssigned) * 100)
        : 100;

    res.json({
      todayDeliveries,
      activeOrder: activeOrder || null,
      acceptanceRate,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
