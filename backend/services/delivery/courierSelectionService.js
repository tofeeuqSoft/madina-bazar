import CourierProvider from '../../models/CourierProvider.js';
import Settings from '../../models/Settings.js';
import { selectProviders, fallbackChain } from './deliveryLogic.js';

const settings = async () => (await Settings.findOne()) || {};

export const listProviders = () => CourierProvider.find({}).sort({ priority: 1 });

// Admin selection policy: ADMIN_PRIORITY | COST | SUCCESS_RATE | SPEED | MANUAL
export const selectCourier = async ({ codNeeded = false, district = '', manualCode = null } = {}) => {
  const s = await settings();
  const mode = s.courierSelectionMode || 'ADMIN_PRIORITY';
  const providers = await CourierProvider.find({ status: 'ACTIVE' }).lean();
  if (manualCode && mode === 'MANUAL') {
    const manual = providers.find((p) => p.code === manualCode);
    if (manual) return { provider: manual, mode, chain: [] };
  }
  const ordered = selectProviders({ providers, mode, codNeeded, district });
  const primary = ordered[0] || null;
  return { provider: primary, mode, chain: ordered.slice(1).filter((p) => p.fallbackAllowed !== false) };
};

export const nextFallback = async ({ failedCode, codNeeded = false, district = '' }) => {
  const providers = await CourierProvider.find({ status: 'ACTIVE' }).lean();
  const chain = fallbackChain({ failedCode, providers });
  const ok = chain.find((p) => {
    if (codNeeded && p.codSupported === false) return false;
    if (district && p.coverageDistricts?.length && !p.coverageDistricts.some((d) => String(d).toLowerCase() === String(district).toLowerCase())) return false;
    return true;
  });
  return ok || null;
};

export const recordProviderResult = async ({ code, success }) => {
  const p = await CourierProvider.findOne({ code });
  if (!p) return;
  if (success) {
    p.consecutiveFailures = 0;
    p.successRate = Math.min(1, (p.successRate ?? 1) * 0.95 + 0.05);
  } else {
    p.consecutiveFailures = (p.consecutiveFailures || 0) + 1;
    p.successRate = Math.max(0, (p.successRate ?? 1) * 0.95);
  }
  await p.save();
};
