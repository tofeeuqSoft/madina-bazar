import InventoryBatch from '../../models/InventoryBatch.js';
import InventoryAlert from '../../models/InventoryAlert.js';
import Settings from '../../models/Settings.js';

const settings = async () => (await Settings.findOne()) || {};

// Refresh VALID → EXPIRING_SOON → EXPIRED from dates + threshold.
export const refreshExpiryStatuses = async () => {
  const s = await settings();
  const days = s.expirySoonDays || 30;
  const now = new Date();
  const soon = new Date(now.getTime() + days * 86400000);
  await InventoryBatch.updateMany({ expiryDate: { $lte: now } }, { $set: { expiryStatus: 'EXPIRED' } });
  await InventoryBatch.updateMany(
    { expiryDate: { $gt: now, $lte: soon }, expiryStatus: { $ne: 'EXPIRED' } },
    { $set: { expiryStatus: 'EXPIRING_SOON' } }
  );
  await InventoryBatch.updateMany(
    { $or: [{ expiryDate: { $gt: soon } }, { expiryDate: null }] },
    { $set: { expiryStatus: 'VALID' } }
  );
};

// FEFO: earliest-expiring batch with stock first (null expiry last).
export const fefoBatches = (productId, warehouseId, qty) =>
  InventoryBatch.find({
    product: productId,
    ...(warehouseId ? { warehouse: warehouseId } : {}),
    remainingQuantity: { $gt: 0 },
    expiryStatus: { $ne: 'EXPIRED' },
  })
    .sort({ expiryDate: 1 })
    .limit(10);
