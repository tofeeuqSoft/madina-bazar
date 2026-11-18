import cron from 'node-cron';
import logger from './logger.js';
import Settings from '../models/Settings.js';

// Lightweight in-process scheduler. For multi-instance deployments move
// these to the persistent Job queue (services/jobQueue.js).
export const startScheduler = () => {
  if (process.env.ENABLE_CRON === 'false') {
    logger.info('Scheduler disabled (ENABLE_CRON=false)');
    return { stop: () => {} };
  }

  const jobs = [];

  // Hourly: refresh batch expiry statuses (VALID → EXPIRING_SOON → EXPIRED)
  jobs.push(
    cron.schedule('15 * * * *', async () => {
      try {
        const { refreshExpiryStatuses } = await import('../services/inventory/expiryService.js');
        await refreshExpiryStatuses();
        logger.info('cron: expiry statuses refreshed');
      } catch (e) {
        logger.error(`cron expiry failed: ${e.message}`);
      }
    })
  );

  // Every 6h: sweep stock docs → raise/resolve low & out-of-stock alerts
  jobs.push(
    cron.schedule('30 */6 * * *', async () => {
      try {
        const InventoryStock = (await import('../models/InventoryStock.js')).default;
        const { maybeRaiseAlerts } = await import('../services/inventory/stockService.js');
        const cursor = InventoryStock.find({}).cursor();
        let n = 0;
        for (let doc = await cursor.next(); doc; doc = await cursor.next()) {
          await maybeRaiseAlerts(doc);
          n += 1;
        }
        logger.info(`cron: alert sweep done (${n} SKUs)`);
      } catch (e) {
        logger.error(`cron alert sweep failed: ${e.message}`);
      }
    })
  );

  // Daily 08:00: rider shortage hints per active own zone (logged for admin review)
  jobs.push(
    cron.schedule('0 8 * * *', async () => {
      try {
        const GroceryZone = (await import('../models/GroceryZone.js')).default;
        const Rider = (await import('../models/Rider.js')).default;
        const { planZoneCapacity } = await import('../services/delivery/deliveryLogic.js');
        const zones = await GroceryZone.find({ status: 'ACTIVE', deliveryMode: 'OWN_DELIVERY' }).select('name riderCapacity');
        for (const z of zones) {
          const riders = await Rider.find({ assignedZones: z._id, status: 'ACTIVE' }).select('maxDailyOrders');
          const plan = planZoneCapacity({ expectedDailyOrders: z.riderCapacity || 0, riders });
          if (plan.shortage > 0) logger.warn(`capacity: ${z.name} needs ~${plan.shortage} more rider(s)`);
        }
      } catch (e) {
        logger.error(`cron capacity check failed: ${e.message}`);
      }
    })
  );

  // Daily 03:00: inventory integrity reconcile (read-only + alerts, never auto-fix)
  jobs.push(
    cron.schedule('0 3 * * *', async () => {
      try {
        const { reconcileInventory } = await import('../services/inventory/reconcileService.js');
        const r = await reconcileInventory({});
        logger.info(`cron: reconcile done (checked ${r.checked}, issues ${r.issues.length})`);
      } catch (e) {
        logger.error(`cron reconcile failed: ${e.message}`);
      }
    })
  );

  // Every 30m: reconcile stuck Pending gateway payments (confirm from gateway)
  jobs.push(
    cron.schedule('*/30 * * * *', async () => {
      try {
        const { reconcilePendingPayments } = await import('../services/paymentReconcileService.js');
        const r = await reconcilePendingPayments({});
        if (r.checked > 0) logger.info(`cron: payment reconcile (checked ${r.checked}, confirmed ${r.confirmed}, failed ${r.failed})`);
      } catch (e) {
        logger.error(`cron payment reconcile failed: ${e.message}`);
      }
    })
  );

  // Hourly: retry failed gateway refunds + confirm processing ones
  jobs.push(
    cron.schedule('20 * * * *', async () => {
      try {
        const { sweepRefunds } = await import('../services/refundService.js');
        const r = await sweepRefunds();
        if (r.checked > 0) logger.info(`cron: refund sweep (checked ${r.checked}, paid ${r.paid}, failed ${r.failed})`);
      } catch (e) {
        logger.error(`cron refund sweep failed: ${e.message}`);
      }
    })
  );

  // Every 15m: auto-release expired ACTIVE stock holds (stuck carts/checkouts)
  jobs.push(
    cron.schedule('*/15 * * * *', async () => {
      try {
        const { sweepExpiredReservations } = await import('../services/inventory/stockService.js');
        const r = await sweepExpiredReservations({});
        if (r.checked > 0) logger.info(`cron: reservation sweep (checked ${r.checked}, released ${r.released})`);
      } catch (e) {
        logger.error(`cron reservation sweep failed: ${e.message}`);
      }
    })
  );

  // Daily 04:00: auto return-to-origin for long-stuck FAILED shipments
  jobs.push(
    cron.schedule('0 4 * * *', async () => {
      try {
        const { sweepRto } = await import('../services/delivery/rtoService.js');
        const r = await sweepRto({});
        if (r.checked > 0) logger.info(`cron: rto sweep (checked ${r.checked}, returned ${r.returned})`);
      } catch (e) {
        logger.error(`cron rto sweep failed: ${e.message}`);
      }
    })
  );

  // Weekly Sun 02:00: audit-log CSV cold copy + prune old exports
  jobs.push(
    cron.schedule('0 2 * * 0', async () => {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const dir = process.env.AUDIT_EXPORT_DIR || path.join(process.cwd(), 'storage', 'audit-exports');
        fs.mkdirSync(dir, { recursive: true });
        const InventoryAuditLog = (await import('../models/InventoryAuditLog.js')).default;
        const rows = await InventoryAuditLog.find({}).sort({ createdAt: 1 }).limit(100000);
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = ['createdAt,action,actorRole,entityType,entityId,reason,ip,archived'];
        for (const l of rows) {
          lines.push([l.createdAt?.toISOString(), l.action, l.actorRole, l.entityType, l.entityId, esc(l.reason), l.ip, l.archived ? 'yes' : 'no'].join(','));
        }
        const file = path.join(dir, `audit-${new Date().toISOString().slice(0, 10)}.csv`);
        fs.writeFileSync(file, lines.join('\n'));
        const keepDays = Number(process.env.AUDIT_EXPORT_KEEP_DAYS || 90);
        for (const f of fs.readdirSync(dir)) {
          const fp = path.join(dir, f);
          if (fs.statSync(fp).mtimeMs < Date.now() - keepDays * 86400000) fs.unlinkSync(fp);
        }
        logger.info(`cron: audit export (${rows.length} rows → ${file})`);
      } catch (e) {
        logger.error(`cron audit export failed: ${e.message}`);
      }
    })
  );

  // Daily 06:00: expired order holds auto-release (never stuck on hold)
  jobs.push(
    cron.schedule('0 6 * * *', async () => {
      try {
        const { sweepExpiredHolds } = await import('../services/orderMgmt/holdSweepService.js');
        const r = await sweepExpiredHolds({});
        if (r.checked > 0) logger.info(`cron: hold sweep (checked ${r.checked}, resumed ${r.resumed})`);
      } catch (e) {
        logger.error(`cron hold sweep failed: ${e.message}`);
      }
    })
  );

  // Daily at configured hour: restock forecast summary SMS (ORDER_NOW/OUT, top 5)
  jobs.push(
    cron.schedule('0 * * * *', async () => {
      try {
        const { default: Settings } = await import('../models/Settings.js');
        const s = await Settings.findOne().select('forecastSmsHour').lean();
        const hour = s?.forecastSmsHour ?? 9;
        const now = new Date();
        if (now.getHours() === (Number(forecastSmsHour) || 9) && now.getMinutes() < 5) {
          const { dispatchForecastAlerts } = await import('../services/alertDispatchService.js');
          const r = await dispatchForecastAlerts({});
          if (r.sent) logger.info(`cron: forecast SMS sent (${r.count} urgent)`);
        }
      } catch (e) {
        logger.error(`cron forecast SMS failed: ${e.message}`);
      }
    })
  );

  // Hourly: auto-confirm courier dispatches past the timer (Order Manager gate)
  // + SLA nudges (2h reminder → 4h escalation) for still-waiting bookings
  jobs.push(
    cron.schedule('25 * * * *', async () => {
      try {
        const { sweepDispatchConfirms, sweepDispatchSla } = await import('../services/delivery/orchestratorService.js');
        const r = await sweepDispatchConfirms();
        if (r.checked > 0) logger.info(`cron: dispatch confirms (checked ${r.checked}, confirmed ${r.confirmed})`);
        const s = await sweepDispatchSla({});
        if (s.checked > 0) logger.info(`cron: dispatch SLA (waiting ${s.checked}, reminded ${s.reminded}, escalated ${s.escalated})`);
      } catch (e) {
        logger.error(`cron dispatch confirms failed: ${e.message}`);
      }
    })
  );

  // Hourly :05 — scheduled pricing apply/revert (flash sales)
  jobs.push(
    cron.schedule('5 * * * *', async () => {
      try {
        const { sweepSaleSchedules } = await import('../services/saleScheduleService.js');
        const r = await sweepSaleSchedules({});
        if (r.applied + r.reverted > 0) logger.info(`cron: sale schedules (applied ${r.applied}, reverted ${r.reverted})`);
      } catch (e) {
        logger.error(`cron sale schedules failed: ${e.message}`);
      }
    })
  );

  logger.info('Scheduler started (expiry hourly, alerts 6h, capacity daily, reconcile daily, payments 30m, refunds hourly, reservations 15m, rto daily, audit weekly, holds daily, forecast daily, dispatch hourly, pricing hourly)');
  return { stop: () => jobs.forEach((j) => j.stop()) };
};
