import InventoryStock from '../../models/InventoryStock.js';
import StockMovement from '../../models/StockMovement.js';
import StockReservation from '../../models/StockReservation.js';
import StockAdjustment from '../../models/StockAdjustment.js';
import Warehouse from '../../models/Warehouse.js';
import WarehouseTransfer from '../../models/WarehouseTransfer.js';
import InventoryBatch from '../../models/InventoryBatch.js';
import InventoryAlert from '../../models/InventoryAlert.js';
import InventoryAuditLog from '../../models/InventoryAuditLog.js';
import { searchRegex } from '../../utils/safeRegex.js';

export const stockList = ({ search, warehouse, status, page = 1, limit = 20 }) => {
  const q = {};
  if (warehouse) q.warehouse = warehouse;
  if (status) q.status = status;
  if (search) q.$or = [{ sku: searchRegex(search) }];
  const skip = (Number(page) - 1) * Number(limit);
  const find = InventoryStock.find(q)
    .populate('product', 'name sku slug regularPrice salePrice costPrice images isActive')
    .populate('warehouse', 'name code')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(Number(limit));
  return Promise.all([find, InventoryStock.countDocuments(q)]);
};

export const movementList = ({ product, warehouse, type, from, to, page = 1, limit = 30, includeArchived = false }) => {
  const q = {};
  if (!includeArchived) q.archived = { $ne: true };
  if (product) q.product = product;
  if (warehouse) q.warehouse = warehouse;
  if (type) q.type = type;
  if (from || to) q.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
  const skip = (Number(page) - 1) * Number(limit);
  return Promise.all([
    StockMovement.find(q).populate('product', 'name sku').populate('warehouse', 'name code').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    StockMovement.countDocuments(q),
  ]);
};

export const dashboard = async () => {
  const [prodAgg, whAgg, todayIn, todayOut, todayAdj, todayTransfers, alerts, batches] = await Promise.all([
    InventoryStock.aggregate([
      {
        $group: {
          _id: null,
          units: { $sum: '$onHand' },
          available: { $sum: '$available' },
          reserved: { $sum: '$reserved' },
          damaged: { $sum: '$damaged' },
          lost: { $sum: '$lost' },
          expired: { $sum: '$expired' },
          value: { $sum: { $multiply: ['$available', '$averageCost'] } },
          skus: { $sum: 1 },
        },
      },
    ]),
    InventoryStock.aggregate([
      { $group: { _id: '$warehouse', stock: { $sum: '$onHand' }, available: { $sum: '$available' }, reserved: { $sum: '$reserved' }, damaged: { $sum: '$damaged' }, value: { $sum: { $multiply: ['$available', '$averageCost'] } } } },
    ]),
    StockMovement.countDocuments({ createdAt: { $gte: dayStart() }, type: { $in: ['PURCHASE', 'RESTOCK', 'TRANSFER_IN', 'ADJUSTMENT_IN'] } }),
    StockMovement.countDocuments({ createdAt: { $gte: dayStart() }, type: { $in: ['SALE', 'TRANSFER_OUT', 'ADJUSTMENT_OUT'] } }),
    StockAdjustment.countDocuments({ createdAt: { $gte: dayStart() } }),
    WarehouseTransfer.countDocuments({ createdAt: { $gte: dayStart() } }),
    InventoryAlert.countDocuments({ status: 'ACTIVE' }),
    InventoryBatch.countDocuments({ expiryStatus: 'EXPIRED' }),
  ]);
  const [low, out, warehouses] = await Promise.all([
    InventoryStock.countDocuments({ status: 'LOW_STOCK' }),
    InventoryStock.countDocuments({ status: 'OUT_OF_STOCK' }),
    Warehouse.find({}).select('name code'),
  ]);
  const whMap = new Map(warehouses.map((w) => [String(w._id), w]));
  const p = prodAgg[0] || {};
  return {
    totalSKUs: p.skus || 0,
    totalUnits: p.units || 0,
    availableStock: p.available || 0,
    reservedStock: p.reserved || 0,
    incomingStock: 0,
    lowStock: low,
    outOfStock: out,
    damagedStock: p.damaged || 0,
    lostStock: p.lost || 0,
    expiredStock: p.expired || 0,
    expiringSoon: await InventoryBatch.countDocuments({ expiryStatus: 'EXPIRING_SOON' }),
    inventoryValue: Math.round(p.value || 0),
    warehouses: (whAgg || []).map((w) => ({ ...(whMap.get(String(w._id))?.toObject?.() || {}), ...w })),
    today: { stockIn: todayIn, stockOut: todayOut, adjustments: todayAdj, transfers: todayTransfers },
    activeAlerts: alerts,
    expiredBatches: batches,
  };
};

const dayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const valuation = () =>
  InventoryStock.aggregate([
    {
      $group: {
        _id: '$product',
        available: { $sum: '$available' },
        value: { $sum: { $multiply: ['$available', '$averageCost'] } },
      },
    },
    { $sort: { value: -1 } },
    { $limit: 200 },
  ]);

export { StockReservation, StockAdjustment, WarehouseTransfer, InventoryBatch, InventoryAlert, InventoryAuditLog };
