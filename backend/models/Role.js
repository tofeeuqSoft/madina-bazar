import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    permissions: [
      {
        type: String,
      },
    ],
    isSystem: {
      type: Boolean,
      default: false, // true for SUPER_ADMIN etc.
    },
  },
  { timestamps: true }
);

const Role = mongoose.model('Role', roleSchema);
export default Role;
