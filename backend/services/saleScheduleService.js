import Product from '../models/Product.js';

// Scheduled pricing (flash sales): within [startDate, endDate] salePrice is
// forced to schedule.price (original kept in preSale); after the window it
// reverts. Manual salePrice edits mid-window are overwritten next sweep —
// that is intentional (schedule is the source of truth while active).
export const sweepSaleSchedules = async ({ limit = 200 } = {}) => {
  const now = new Date();
  const scheduled = await Product.find({
    'saleSchedule.price': { $ne: null },
    'saleSchedule.startDate': { $ne: null },
    'saleSchedule.endDate': { $ne: null },
  }).select('salePrice regularPrice saleSchedule').limit(limit).lean();
  const report = { checked: scheduled.length, applied: 0, reverted: 0, errors: [] };
  for (const p of scheduled) {
    try {
      const s = p.saleSchedule;
      const inWindow = new Date(s.startDate) <= now && now <= new Date(s.endDate);
      if (inWindow) {
        if ((p.salePrice ?? null) !== s.price) {
          await Product.updateOne(
            { _id: p._id },
            { $set: { salePrice: s.price, 'saleSchedule.preSale': p.salePrice ?? null, 'saleSchedule.lastApplied': now } }
          );
          report.applied += 1;
        }
      } else if (now > new Date(s.endDate) && (p.salePrice ?? null) === s.price) {
        await Product.updateOne(
          { _id: p._id },
          { $set: { salePrice: s.preSale ?? null, 'saleSchedule.lastApplied': now } }
        );
        report.reverted += 1;
      }
    } catch (e) {
      report.errors.push({ product: String(p._id), error: e.message });
    }
  }
  return report;
};
