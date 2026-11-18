import LedgerLine from '../models/LedgerLine.js';
import { activeJournalIds } from './journalService.js';

/**
 * P&L computed from POSTED journals only (single source of truth).
 * Revenue net = credits(SALES/DELIVERY/OTHER) − debits(SALES_RETURNS).
 */
export const calculateProfitLoss = async ({ from, to } = {}) => {
  const match = { date: {} };
  if (from) match.date.$gte = new Date(from);
  if (to) match.date.$lte = new Date(to);
  if (!Object.keys(match.date).length) delete match.date;

  // Only active posted journals (void pairs excluded — see journalService)
  const ids = await activeJournalIds();
  match.journal = { $in: ids };

  const rows = await LedgerLine.aggregate([
    { $match: match },
    { $group: { _id: '$code', debit: { $sum: '$debit' }, credit: { $sum: '$credit' } } },
  ]);
  const by = Object.fromEntries(rows.map((r) => [r._id, r]));

  const sum = (...codes) => codes.reduce((s, c) => s + (by[c]?.credit || 0) - (by[c]?.debit || 0), 0);
  const sumDr = (...codes) => codes.reduce((s, c) => s + (by[c]?.debit || 0) - (by[c]?.credit || 0), 0);

  const productSales = sum('SALES_REVENUE');
  const deliveryRevenue = sum('DELIVERY_REVENUE');
  const otherRevenue = sum('OTHER_REVENUE');
  const returns = sumDr('SALES_RETURNS');
  const totalRevenue = productSales + deliveryRevenue + otherRevenue - returns;

  const cogs = sumDr('COGS');
  const gross = totalRevenue - cogs;

  const expenseCodes = [
    'DELIVERY_EXPENSE', 'MARKETING_EXPENSE', 'SALARY_EXPENSE', 'RENT_EXPENSE',
    'UTILITY_EXPENSE', 'GATEWAY_FEE', 'PACKAGING_EXPENSE', 'OTHER_EXPENSE',
  ];
  const expenses = {};
  let totalOpEx = 0;
  for (const c of expenseCodes) {
    expenses[c] = sumDr(c);
    totalOpEx += expenses[c];
  }

  const totalCost = cogs + totalOpEx;
  const net = totalRevenue - totalCost;

  return {
    revenue: { productSales, deliveryRevenue, otherRevenue, returns, total: totalRevenue },
    cost: { cogs, operating: expenses, operatingTotal: totalOpEx, total: totalCost },
    result: {
      gross,
      grossMargin: totalRevenue ? +((gross / totalRevenue) * 100).toFixed(2) : 0,
      net,
      netMargin: totalRevenue ? +((net / totalRevenue) * 100).toFixed(2) : 0,
    },
  };
};

export default { calculateProfitLoss };
