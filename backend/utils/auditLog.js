import AuditLog from '../models/AuditLog.js';

/**
 * Fire-and-forget audit entry for Delivery Management changes.
 * Never throws — logging must not break the main action.
 */
export const logAudit = (req, { action, entity = '', entityId = '', entityName = '', details = {} }) => {
  try {
    const user = req?.user;
    AuditLog.create({
      actor: user?._id || user?.id,
      actorName: user?.name || '',
      actorRole: user?.role || '',
      action,
      entity,
      entityId: String(entityId || ''),
      entityName: String(entityName || ''),
      details,
      ip: req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || '',
    }).catch(() => {});
  } catch (_) {}
};

export default { logAudit };
