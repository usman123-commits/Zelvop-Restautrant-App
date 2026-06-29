const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      required: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerPhone: {
      type: String,
      required: [true, 'Customer phone is required'],
      trim: true,
    },
    deliveryAddress: {
      type: String,
      required: [true, 'Delivery address is required'],
      trim: true,
    },
    deliveryNotes: {
      type: String,
      default: null,
      trim: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (v) => v.length > 0,
        message: 'Order must have at least one item',
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'prepaid'],
      required: [true, 'Payment method is required'],
    },
    status: {
      type: String,
      enum: [
        'pending_assignment',
        'assigned',
        'accepted',
        'picked_up',
        'delivered',
        'cancelled',
      ],
      default: 'pending_assignment',
    },
    source: {
      type: String,
      enum: ['whatsapp', 'dashboard'],
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedRiderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedAt: { type: Date, default: null },
    acceptTimeoutAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: {
      type: String,
      enum: ['owner', 'rider'],
      default: null,
    },
    cancelReason: { type: String, default: null },
    declineReason: { type: String, default: null },
    proofPhotoUrl: { type: String, default: null },
    riderDeliveryNotes: { type: String, default: null },
    cashCollected: { type: Boolean, default: null },
  },
  { timestamps: true }
);

orderSchema.index({ assignedRiderId: 1, status: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
