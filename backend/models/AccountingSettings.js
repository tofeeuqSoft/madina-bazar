import mongoose from 'mongoose';

// Singleton-ish configurable business rules (latest doc wins).
// NOTHING financial is hard-coded: tax, fees, methods, categories, fiscal year.
const accountingSettingsSchema = new mongoose.Schema(
  {
    taxRate: { type: Number, default: 0, min: 0, max: 100 }, // VAT % on taxable base
    taxName: { type: String, default: 'VAT' },
    // BD VAT mode (NBR VAT & SD Act 2012, standard rate 15%):
    // EXCLUSIVE = VAT added on top of price; INCLUSIVE = VAT already inside price (display only);
    // DISABLED = no VAT. Default EXCLUSIVE+0% preserves legacy math until admin configures.
    vatMode: { type: String, enum: ['DISABLED', 'EXCLUSIVE', 'INCLUSIVE'], default: 'EXCLUSIVE' },
    vatBin: { type: String, default: '', trim: true }, // Business Identification Number for invoices
    // Gateway fee % per method, e.g. { BKASH: 1.5, NAGAD: 1.2, SSLCOMMERZ: 2.5 }
    gatewayFees: { type: Map, of: Number, default: {} },
    paymentMethods: { type: [String], default: ['COD', 'BKASH', 'NAGAD', 'SSLCOMMERZ', 'CARD', 'BANK', 'CASH', 'OTHER'] },
    expenseCategories: {
      type: [String],
      default: [
        'Delivery Expense', 'Employee Salary', 'Office Rent', 'Electricity', 'Internet',
        'Packaging', 'Marketing', 'Advertising', 'Software/API', 'Warehouse',
        'Transport', 'Maintenance', 'Purchase Related Expense', 'Bank Charge',
        'Gateway Charge', 'Other Expense',
      ],
    },
    // Category → expense account code mapping (overrides auto-map)
    expenseAccountMap: { type: Map, of: String, default: {} },
    fiscalYearStartMonth: { type: Number, default: 7, min: 1, max: 12 }, // July (BD)
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const AccountingSettings = mongoose.model('AccountingSettings', accountingSettingsSchema);
export default AccountingSettings;
