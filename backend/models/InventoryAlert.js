import mongoose from 'mongoose';

const inventoryAlertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRING_SOON', 'EXPIRED', 'LARGE_STOCK_CHANGE', 'UNUSUAL_STOCK_MOVEMENT', 'TRANSFER_DELAY', 'RECEIVING_DELAY'],
      required: true,
    },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    sku: { type: String, default: '' },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    message: { type: String, default: '' },
    status: { type: String, enum: ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'], default: 'ACTIVE' },
    channel: { type: String, enum: ['IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WHATSAPP'], default: 'IN_APP' },
  },
  { timestamps: true }
);

inventoryAlertSchema.index({ type: 1, status: 1, createdAt: -1 });
inventoryAlertSchema.index({ product: 1, warehouse: 1, type: 1, status: 1 });

const InventoryAlert = mongoose.model('InventoryAlert', inventoryAlertSchema);
export default InventoryAlert;
