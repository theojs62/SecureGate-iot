const mongoose = require("mongoose");

const badgeSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true, trim: true },

    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    role: { type: String, enum: ["admin", "user", "security"], default: "user" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Badge", badgeSchema);
