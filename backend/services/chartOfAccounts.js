import AccountingAccount from '../models/AccountingAccount.js';

// Default Chart of Accounts (spec §16). Idempotent — only missing codes seed.
export const DEFAULT_CHART = [
  // Assets
  { code: 'CASH', name: 'Cash in Hand', type: 'Asset', system: true },
  { code: 'BANK', name: 'Bank Account', type: 'Asset', system: true },
  { code: 'BKASH', name: 'bKash Account', type: 'Asset', system: true },
  { code: 'NAGAD', name: 'Nagad Account', type: 'Asset', system: true },
  { code: 'GATEWAY', name: 'Payment Gateway Receivable', type: 'Asset', system: true },
  { code: 'ACC_RECEIVABLE', name: 'Accounts Receivable', type: 'Asset', system: true },
  { code: 'INVENTORY', name: 'Inventory', type: 'Asset', system: true },
  // Liabilities
  { code: 'ACC_PAYABLE', name: 'Accounts Payable', type: 'Liability', system: true },
  { code: 'SUPPLIER_PAYABLE', name: 'Supplier Payable', type: 'Liability', system: true },
  { code: 'TAX_PAYABLE', name: 'Tax / VAT Payable', type: 'Liability', system: true },
  // Equity
  { code: 'OWNER_EQUITY', name: 'Owner Equity', type: 'Equity', system: true },
  // Revenue
  { code: 'SALES_REVENUE', name: 'Product Sales Revenue', type: 'Revenue', system: true },
  { code: 'DELIVERY_REVENUE', name: 'Delivery Revenue', type: 'Revenue', system: true },
  { code: 'OTHER_REVENUE', name: 'Other Revenue', type: 'Revenue', system: true },
  { code: 'SALES_RETURNS', name: 'Sales Returns & Refunds', type: 'Revenue', system: true }, // contra-revenue (debit-normal)
  // Expenses
  { code: 'COGS', name: 'Cost of Goods Sold', type: 'Expense', system: true },
  { code: 'DELIVERY_EXPENSE', name: 'Delivery Expense', type: 'Expense', system: true },
  { code: 'MARKETING_EXPENSE', name: 'Marketing Expense', type: 'Expense', system: true },
  { code: 'SALARY_EXPENSE', name: 'Salary Expense', type: 'Expense', system: true },
  { code: 'RENT_EXPENSE', name: 'Rent Expense', type: 'Expense', system: true },
  { code: 'UTILITY_EXPENSE', name: 'Utility Expense', type: 'Expense', system: true },
  { code: 'GATEWAY_FEE', name: 'Gateway Fee Expense', type: 'Expense', system: true },
  { code: 'PACKAGING_EXPENSE', name: 'Packaging Expense', type: 'Expense', system: true },
  { code: 'OTHER_EXPENSE', name: 'Other Expense', type: 'Expense', system: true },
];

const CONTRA_DEBIT_REVENUE = new Set(['SALES_RETURNS']);

export const isContraDebit = (code) => CONTRA_DEBIT_REVENUE.has(code);

export const ensureChartOfAccounts = async () => {
  for (const row of DEFAULT_CHART) {
    await AccountingAccount.findOneAndUpdate(
      { code: row.code },
      { $setOnInsert: { ...row, isActive: true } },
      { upsert: true, new: true }
    );
  }
  return AccountingAccount.countDocuments();
};

export const getAccountOrThrow = async (code) => {
  const acc = await AccountingAccount.findOne({ code: String(code).toUpperCase(), isActive: true });
  if (!acc) throw new Error(`Unknown/inactive account: ${code}`);
  return acc;
};
