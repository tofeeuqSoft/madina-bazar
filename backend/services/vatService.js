import AccountingSettings from '../models/AccountingSettings.js';

// Central Bangladesh VAT engine (NBR VAT & SD Act 2012; standard rate 15%).
// Single source of truth — checkout preview, order creation and invoices
// all flow through here. Frontend values are NEVER trusted.
//
// - EXCLUSIVE: VAT added on top → vatAdditive goes into the grand total.
// - INCLUSIVE: VAT already inside prices → vatAmount is display-only,
//   vatAdditive is 0, grand total unchanged.
// - DISABLED or rate<=0: everything 0 (legacy default).
// - vatExempt lines (e.g. unprocessed agri essentials) leave the base;
//   coupon discount is split pro-rata between taxable and exempt parts.

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export const getVatConfig = async () => {
  let settings = null;
  try {
    settings = await AccountingSettings.findOne().sort({ updatedAt: -1 }).lean();
  } catch (_) {}
  return {
    mode: settings?.vatMode || 'EXCLUSIVE',
    rate: Number(settings?.taxRate) || 0,
    name: settings?.taxName || 'VAT',
    bin: settings?.vatBin || '',
  };
};

export const computeVat = ({ lines = [], netSubtotal = 0, settings = null } = {}) => {
  const mode = settings?.mode || settings?.vatMode || 'EXCLUSIVE';
  const rate = Number(settings?.rate ?? settings?.taxRate) || 0;
  const name = settings?.name ?? settings?.taxName ?? 'VAT';

  let taxableGross = 0;
  let exemptGross = 0;
  for (const l of lines) {
    const gross = round2((Number(l.price) || 0) * (Number(l.qty ?? l.quantity) || 0));
    if (l.vatExempt) exemptGross += gross;
    else taxableGross += gross;
  }
  const gross = taxableGross + exemptGross;
  // Discount (gross - net) split pro-rata so exempt goods never attract VAT.
  const discount = Math.max(0, gross - Number(netSubtotal || 0));
  const taxableShare = gross > 0 ? taxableGross / gross : 1;
  const base = Math.max(0, taxableGross - discount * taxableShare);
  const exemptBase = Math.max(0, exemptGross - discount * (1 - taxableShare));

  let vatAmount = 0;
  let vatAdditive = 0;
  const normMode = ['DISABLED', 'EXCLUSIVE', 'INCLUSIVE'].includes(mode) ? mode : 'EXCLUSIVE';
  if (normMode !== 'DISABLED' && rate > 0 && base > 0) {
    if (normMode === 'EXCLUSIVE') {
      vatAmount = round2((base * rate) / 100);
      vatAdditive = vatAmount;
    } else {
      // INCLUSIVE: extract VAT already inside the price for display.
      vatAmount = round2(base - base / (1 + rate / 100));
      vatAdditive = 0;
    }
  }

  return {
    mode: normMode,
    rate,
    name,
    bin: settings?.bin ?? settings?.vatBin ?? '',
    taxableBase: round2(base),
    exemptBase: round2(exemptBase),
    vatAmount, // display value (also stored in order.taxAmount snapshot)
    vatAdditive, // amount added to grand total (0 unless EXCLUSIVE)
  };
};

export default { getVatConfig, computeVat };
