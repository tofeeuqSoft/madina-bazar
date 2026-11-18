import mongoose from 'mongoose';

const supportTeamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
    },
    // Team type for routing
    teamType: {
      type: String,
      enum: [
        'GENERAL_SUPPORT',
        'PAYMENT_SUPPORT',
        'DELIVERY_SUPPORT',
        'RETURN_TEAM',
        'REFUND_TEAM',
        'TECHNICAL_TEAM',
        'PRODUCT_SUPPORT',
        'VIP_SUPPORT',
      ],
      required: true,
    },
    // Assignment rules
    assignmentRule: {
      type: String,
      enum: ['ROUND_ROBIN', 'LEAST_BUSY', 'SKILL_BASED', 'CATEGORY_BASED'],
      default: 'ROUND_ROBIN',
    },
    // Members - references to Users with support agent role
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // AI assignment override
    aiEnabled: {
      type: Boolean,
      default: true,
    },
    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
supportTeamSchema.index({ teamType: 1, isActive: 1 });

const SupportTeam = mongoose.model('SupportTeam', supportTeamSchema);
export default SupportTeam;