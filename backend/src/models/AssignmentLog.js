const mongoose = require('mongoose');

const assignmentLogSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: [
        'assigned',
        'accepted',
        'declined',
        'timeout',
        'reassigned_away',
        'cancelled',
      ],
      required: true,
    },
    reason: {
      type: String,
      default: null,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

assignmentLogSchema.index({ orderId: 1 });

module.exports = mongoose.model('AssignmentLog', assignmentLogSchema);
