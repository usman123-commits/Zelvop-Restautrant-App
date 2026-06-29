const Order = require('../models/Order');

const generateOrderId = async () => {
  const lastOrder = await Order.findOne({}, { orderId: 1 })
    .sort({ createdAt: -1 })
    .lean();

  let nextNum = 1;
  if (lastOrder && lastOrder.orderId) {
    const match = lastOrder.orderId.match(/ORD-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `ORD-${String(nextNum).padStart(4, '0')}`;
};

module.exports = generateOrderId;
