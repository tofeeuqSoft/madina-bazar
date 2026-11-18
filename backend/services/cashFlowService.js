import LedgerLine from '../models/LedgerLine.js';
import { activeJournalIds } from './journalService.js';

/**
 * Cash flow (MVP): Cash In / Cash Out / Net from cash-like accounts.
 * Operating vs Investing split by module heuristic:
 *  - PURCHASE inventory legs → Investing, everything else → Operating.
 */
const CASH_CODES = ['CASH', 'BANK', 'BKASH', 'NAGAD', 'GATEWAY'];

export const calculateCashFlow = async ({ from, to } = {}) => {
  const match = { code: { $in: CASH_CODES }, journal: { $in: await activeJournalIds() } };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }

  const rows = await LedgerLine.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'journals',
        localField: 'journal',
        foreignField: '_id',
        as: 'j',
      },
    },
    { $unwind: { path: '$j', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: {
          module: '$j.module',
          ref: '$j.referenceType',
        },
        inflow: { $sum: '$debit' },
        outflow: { $sum: '$credit' },
      },
    },
  ]);

  let operatingIn = 0;
  let operatingOut = 0;
  let investingOut = 0;
  let investingIn = 0;
  const byModule = {};
  for (const r of rows) {
    const mod = r._id?.module || 'OTHER';
    byModule[mod] = byModule[mod] || { inflow: 0, outflow: 0 };
    byModule[mod].inflow += r.inflow;
    byModule[mod].outflow += r.outflow;
    if (mod === 'PURCHASE') {
      investingOut += r.outflow;
      investingIn += r.inflow;
    } else {
      operatingIn += r.inflow;
      operatingOut += r.outflow;
    }
  }

  // Include sale-date filtering note: journal dates drive the report
  return {
    operating: { inflow: operatingIn, outflow: operatingOut, net: operatingIn - operatingOut },
    investing: { inflow: investingIn, outflow: investingOut, net: investingIn - investingOut },
    financing: { inflow: 0, outflow: 0, net: 0 },
    totals: {
      cashIn: operatingIn + investingIn,
      cashOut: operatingOut + investingOut,
      net: operatingIn - operatingOut + (investingIn - investingOut),
    },
    byModule,
  };
};

export default { calculateCashFlow };
