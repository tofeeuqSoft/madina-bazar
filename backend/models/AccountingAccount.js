import mongoose from 'mongoose';

// Chart of Accounts — admin-extensible, system rows seeded & protected.
const accountingAccountSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'],
      required: true,
    },
    parent: {
      type: String,
      default: '',
    },
    isSystem: {
      type: Boolean,
      default: false, // system rows cannot be deleted/renamed destructively
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

accountingAccountSchema.index({ type: 1, isActive: 1 });

const AccountingAccount = mongoose.model('AccountingAccount', accountingAccountSchema);
export default AccountingAccount;
