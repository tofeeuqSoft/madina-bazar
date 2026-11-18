import SupportAuditLog from '../../models/SupportAuditLog.js';

export const logSupportAction = async ({
  actorType = 'SYSTEM',
  actor = null,
  aiAgentId = null,
  action,
  module = 'SUPPORT',
  referenceId = null,
  ticket = null,
  previousValue = null,
  newValue = null,
  toolUsed = null,
  intent = null,
}) => {
  try {
    await SupportAuditLog.create({
      actorType,
      actor,
      aiAgentId,
      action,
      module,
      referenceId,
      ticket,
      previousValue,
      newValue,
      toolUsed,
      intent,
    });
  } catch (err) {
    console.error('Support audit log failed:', err.message);
  }
};

export const actorTypeOf = (user, fallback = 'HUMAN_AGENT') => {
  if (!user) return 'SYSTEM';
  if (user.role === 'CUSTOMER') return 'CUSTOMER';
  return fallback;
};
