import InventoryAuditLog from '../../models/InventoryAuditLog.js';

export const logInventoryAction = async ({
  action,
  actor = null,
  performedByType = 'HUMAN',
  entityType = '',
  entityId = '',
  oldValue = null,
  newValue = null,
  reason = '',
  metadata = {},
  ip = '',
}) => {
  try {
    await InventoryAuditLog.create({
      action,
      actor: actor?._id || actor || null,
      actorRole: actor?.role || '',
      performedByType,
      entityType,
      entityId: String(entityId || ''),
      oldValue,
      newValue,
      reason,
      metadata,
      ip,
    });
  } catch (e) {
    console.error('inventory audit failed:', e.message);
  }
};
