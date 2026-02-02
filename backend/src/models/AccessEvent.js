const mongoose = require("mongoose");

const accessEventSchema = new mongoose.Schema(
  {
    badgeUid: { type: String, required: true, trim: true },
    result: { type: Boolean, required: true }, // true = accès OK ; false = refusé

    badgeId: { type: mongoose.Schema.Types.ObjectId, ref: "Badge", default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    topic: { type: String, default: "CESI/action/entrer" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AccessEvent", accessEventSchema);
