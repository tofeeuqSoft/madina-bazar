import mongoose from 'mongoose';

// Courier API call log — metadata only. Request/response BODIES are never
// stored (they may contain secrets); only codes, durations and error messages.
const courierApiLogSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    operation: { type: String, required: true }, // CREATE_SHIPMENT | CANCEL | STATUS | TRACKING | ...
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', default: null },
    referenceId: { type: String, default: '' },
    responseCode: { type: String, default: '' },
    success: { type: Boolean, default: false },
    durationMs: { type: Number, default: 0 },
    error: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

courierApiLogSchema.index({ provider: 1, createdAt: -1 });
courierApiLogSchema.index({ shipment: 1 });

const CourierApiLog = mongoose.model('CourierApiLog', courierApiLogSchema);
export default CourierApiLog;
