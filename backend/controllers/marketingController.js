import { salesOverview, salesSeries, hourlyHeatmap } from '../services/marketing/salesAnalytics.js';
import { productPerformance, categoryPerformance, slowMovers } from '../services/marketing/productAnalytics.js';
import { rfmSegments, newVsReturning } from '../services/marketing/rfmService.js';
import { geoPerformance, couponPerformance, retentionCohorts, abandonedCarts, qualityReport } from '../services/marketing/geoCouponRetention.js';

const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// All marketing endpoints are READ-ONLY aggregations over existing data.
export const getDashboard = asyncH(async (req, res) => {
  const { from, to } = req.query;
  const [sales, series, split] = await Promise.all([
    salesOverview({ from, to }),
    salesSeries({ from, to, grain: 'day' }),
    newVsReturning(),
  ]);
  res.json({ success: true, data: { sales, series: series.rows.slice(-14), growthPct: series.growthPct, split } });
});
export const getSales = asyncH(async (req, res) => {
  const { from, to, grain } = req.query;
  const [overview, series, heatmap] = await Promise.all([
    salesOverview({ from, to }),
    salesSeries({ from, to, grain: grain || 'day' }),
    hourlyHeatmap(),
  ]);
  res.json({ success: true, data: { overview, series: series.rows, growthPct: series.growthPct, bestHours: heatmap } });
});
export const getProducts = asyncH(async (req, res) => {
  const [top, categories, slow] = await Promise.all([
    productPerformance({ limit: req.query.limit || 20 }),
    categoryPerformance(),
    slowMovers({ limit: 20 }),
  ]);
  res.json({ success: true, data: { top, categories, slow } });
});
export const getRfm = asyncH(async (req, res) => {
  res.json({ success: true, data: await rfmSegments({ limit: 2000 }) });
});
export const getGeo = asyncH(async (req, res) => {
  res.json({ success: true, data: await geoPerformance() });
});
export const getCoupons = asyncH(async (req, res) => {
  res.json({ success: true, data: await couponPerformance() });
});
export const getRetention = asyncH(async (req, res) => {
  res.json({ success: true, data: await retentionCohorts() });
});
export const getGrowth = asyncH(async (req, res) => {
  const [abandoned, heatmap, split] = await Promise.all([
    abandonedCarts({ days: 1 }),
    hourlyHeatmap(),
    newVsReturning(),
  ]);
  res.json({ success: true, data: { abandoned, bestHours: heatmap, split } });
});
export const getQuality = asyncH(async (req, res) => {
  res.json({ success: true, data: await qualityReport() });
});
export const exportRfm = asyncH(async (req, res) => {
  const { customers } = await rfmSegments({ limit: 2000 });
  const wanted = req.query.segment;
  const rows = (wanted ? customers.filter((c) => c.segment === wanted) : customers).filter((c) => c.phone);
  const lines = ['name,phone,segment,recencyDays,frequency,monetary'];
  for (const c of rows) lines.push([`"${c.name}"`, c.phone, `"${c.segment}"`, c.recencyDays, c.frequency, c.monetary].join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="rfm-${wanted || 'all'}.csv"`);
  res.send(lines.join('\n'));
});
