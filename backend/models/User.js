import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      // Optional for social (Google/Facebook) signups — placeholder set
      // until customer adds a real number from profile.
      trim: true,
      default: '',
    },
    password: {
      type: String,
      required: function () {
        return this.authProvider === 'local';
      },
      minlength: 6,
      select: false,
    },
    // Social login
    authProvider: {
      type: String,
      enum: ['local', 'google', 'facebook'],
      default: 'local',
    },
    googleId: {
      type: String,
      default: '',
      index: true,
    },
    facebookId: {
      type: String,
      default: '',
      index: true,
    },
    role: {
      type: String,
      enum: [
        'SUPER_ADMIN',
        'SUB_ADMIN',
        'ORDER_MANAGER',
        'INVENTORY_MANAGER',
        'DELIVERY_MANAGER',
        'DELIVERY_RIDER',
        'ACCOUNTANT',
        'CUSTOMER',
        'SUPPORT_MANAGER',
        'SUPPORT_AGENT',
        'DELIVERY_SUPPORT',
        'PAYMENT_SUPPORT',
        'REFUND_MANAGER',
        'AI_MANAGER',
      ],
      default: 'CUSTOMER',
    },
    // Dynamic permissions for Sub Admin etc.
    permissions: [
      {
        type: String,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    // For Delivery Rider
    isAvailable: {
      type: Boolean,
      default: true,
    },
    // Password recovery OTP (hashed, short-lived)
    resetOTPHash: {
      type: String,
      default: '',
      select: false,
    },
    resetOTPExpire: Date,
    resetOTPAttempts: {
      type: Number,
      default: 0,
    },
    resetOTPVerified: {
      type: Boolean,
      default: false,
    },
    resetOTPVerifiedExpire: Date,
    // TOTP two-factor auth (recommended for SUPER_ADMIN)
    twoFactorSecret: {
      type: String,
      default: '',
      select: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, isActive: 1 });

const User = mongoose.model('User', userSchema);
export default User;
