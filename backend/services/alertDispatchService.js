import { sendSMS } from '../utils/notifications.js';

const alertRecipients = async () => {
  const envList = String(process.env.ALERT_SMS_NUMBERS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (envList.length) return envList;
  const Settings = (await import('../models/Settings.js')).default;
  const s = await Settings.findOne().select('phone').lean();
  return s?.phone ? [s.phone] : [];
};

// Buyer-side early warning: ORDER_NOW items (one summary SMS/day, top 5).
// Same recipient list + best-effort rules as stock alerts.
export const dispatchForecastAlerts = async ({ days = 30, leadTimeDays = 7 } = {}) => {
  try {
    const { forecastDemand } = await import('./demandForecastService.js');
    const fc = await forecastDemand({ days, leadTimeDays, limit: 50 });
    const urgent = (fc.rows || []).filter((r) => r.status === 'ORDER_NOW' || r.status === 'OUT').slice(0, 5);
    if (!urgent.length) return { sent: false, reason: 'nothing-urgent' };
    const toList = await alertRecipients();
    if (!toList.length) return { sent: false, reason: 'no-recipients' };
    const msg = `[MadinaBazar] Restock soon: ${urgent.map((r) => `${r.product?.sku || '?'}(${r.status === 'OUT' ? 'OUT' : `${r.daysLeft}d`})`).join(', ')}`;
    let delivered = 0;
    for (const to of toList) {
      const r = await sendSMS({ to, message: msg });
      if (r?.success && !r?.skipped) delivered += 1;
    }
    return { sent: delivered > 0, count: urgent.length, delivered };
  } catch (e) {
    console.error('[forecast-dispatch]', e.message);
    return { sent: false, error: e.message };
  }
};

// Critical stock alerts → admin phone (SMS). Best-effort: never throws,
// never blocks the stock flow. Only OUT_OF_STOCK + EXPIRED (LOW stays
// in-app — otherwise every dip spams the phone).
// Recipients: ALERT_SMS_NUMBERS env (comma) else Settings.phone.
// Unconfigured sender → sendSMS logs + skips silently.
export const dispatchCriticalAlert = async (alert) => {
  try {
    if (!alert || !['OUT_OF_STOCK', 'EXPIRED'].includes(alert.type)) return { sent: false };
    const toList = await alertRecipients();
    if (!toList.length) return { sent: false, reason: 'no-recipients' };
    const label = alert.type === 'OUT_OF_STOCK' ? 'OUT OF STOCK' : 'EXPIRED';
    const msg = `[MadinaBazar] ${label}: ${alert.sku || 'item'} — check inventory app.`;
    let delivered = 0;
    for (const to of toList) {
      const r = await sendSMS({ to, message: msg });
      if (r?.success && !r?.skipped) delivered += 1;
    }
    // Channel reflects reality: SMS only if at least one provider accepted it.
    if (delivered > 0) {
      alert.channel = 'SMS';
      await alert.save().catch(() => {});
    }
    return { sent: delivered > 0, count: delivered, attempted: toList.length };
  } catch (e) {
    console.error('[alert-dispatch]', e.message);
    return { sent: false, error: e.message };
  }
};
