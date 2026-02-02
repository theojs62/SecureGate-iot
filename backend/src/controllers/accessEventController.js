const AccessEvent = require("../models/AccessEvent");

async function listAccessEvents(req, res) {
  const limit = Math.min(Number(req.query.limit || 100), 500);

  const rows = await AccessEvent.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "firstName lastName email")
    .populate("badgeId", "uid")
    .lean();

  res.json(rows);
}

module.exports = { listAccessEvents };
