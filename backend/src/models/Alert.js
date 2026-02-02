const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
   type: {
  type: String,
  enum: ["NO_BADGE_PRESENCE", "DENIED_BADGE", "INTRUSION"],
  required: true
},
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: false },
    relatedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    relatedBadgeUid: { type: String, default: null },
    status: { type: String, enum: ["OPEN", "ACK", "CLOSED"], default: "OPEN" },
    message: { type: String, required: true },
    ackBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    ackAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Alert", alertSchema);
