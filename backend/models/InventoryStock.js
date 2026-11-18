import mongoose from 'mongoose';

// Source of truth for stock. One doc per (product, variantKey, warehouse).
// Available = onHand - reserved - damaged - lost - expired (maintained by
// inventoryService — frontend never calculates).
const inventoryStockSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantKey: { type: String, default: '' }, // e.g. "M|Red" — '' for no variant
    size: { type: String, default: '' },
    color: { type: String, default: '' },
    sku: { type: String, default: '' },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },

    onHand: { type: Number, default: 0, min: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    incoming: { type: Number, default: 0, min: 0 },
    damaged: { type: Number, default: 0, min: 0 },
    lost: { type: Number, default: 0, min: 0 },
    expired: { type: Number, default: 0, min: 0 },
    available: { type: Number, default: 0, min: 0 },

    reorderLevel: { type: Number, default: 10, min: 0 },
    reorderQuantity: { type: Number, default: 50, min: 0 },

    lastPurchaseCost: { type: Number, default: 0, min: 0 },
    averageCost: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'], default: 'IN_STOCK' },
  },
  { timestamps: true }
);

inventoryStockSchema.index({ product: 1, variantKey: 1, warehouse: 1 }, { unique: true });
inventoryStockSchema.index({ sku: 1 });
inventoryStockSchema.index({ warehouse: 1, status: 1 });
inventoryStockSchema.index({ status: 1 });
inventoryStockSchema.index({ product: 1 });

const InventoryStock = mongoose.model('InventoryStock', inventoryStockSchema);
export default InventoryStock;
