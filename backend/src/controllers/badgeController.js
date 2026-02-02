const Badge = require("../models/Badge");
const User = require("../models/User");

// POST /api/badges
async function createBadge(req, res) {
  const { uid, ownerUserId, role, isActive } = req.body;

  if (!uid || typeof uid !== "string" || !uid.trim()) {
    return res.status(400).json({ message: "uid requis" });
  }

  const existing = await Badge.findOne({ uid: uid.trim() }).lean();
  if (existing) return res.status(409).json({ message: "Ce badge UID existe déjà" });

  let user = null;
  if (ownerUserId) {
    user = await User.findById(ownerUserId);
    if (!user) return res.status(404).json({ message: "User introuvable" });

    if (user.badgeId) {
      return res.status(409).json({ message: "Ce user a déjà un badge" });
    }
  }

  const badge = await Badge.create({
    uid: uid.trim(),
    ownerUserId: ownerUserId || null,
    role: role || "user",
    isActive: typeof isActive === "boolean" ? isActive : true,
  });

  // Lien user.badgeId
  if (user) {
    user.badgeId = badge._id;
    await user.save();
  }

  return res.status(201).json(badge);
}

// GET /api/badges
async function listBadges(req, res) {
  const badges = await Badge.find()
    .sort({ createdAt: -1 })
    .populate("ownerUserId", "firstName lastName email")
    .lean();

  res.json(badges);
}

// DELETE /api/badges/:id
async function deleteBadge(req, res) {
  const { id } = req.params;

  const badge = await Badge.findById(id);
  if (!badge) return res.status(404).json({ message: "Badge introuvable" });

  if (badge.ownerUserId) {
    await User.updateOne(
      { _id: badge.ownerUserId, badgeId: badge._id },
      { $set: { badgeId: null } }
    );
  }

  await badge.deleteOne();
  res.json({ ok: true });
}

// PATCH /api/badges/:id/assign
async function assignBadge(req, res) {
  const { id } = req.params;
  const { ownerUserId } = req.body;

  const badge = await Badge.findById(id);
  if (!badge) return res.status(404).json({ message: "Badge introuvable" });

  if (badge.ownerUserId) {
    await User.updateOne(
      { _id: badge.ownerUserId, badgeId: badge._id },
      { $set: { badgeId: null } }
    );
  }

  if (ownerUserId) {
    const user = await User.findById(ownerUserId);
    if (!user) return res.status(404).json({ message: "User introuvable" });

    if (user.badgeId) return res.status(409).json({ message: "Ce user a déjà un badge" });

    badge.ownerUserId = user._id;
    await badge.save();

    user.badgeId = badge._id;
    await user.save();
  } else {
    // assign null
    badge.ownerUserId = null;
    await badge.save();
  }

  const out = await Badge.findById(badge._id)
    .populate("ownerUserId", "firstName lastName email")
    .lean();

  res.json(out);
}

module.exports = {
  createBadge,
  listBadges,
  deleteBadge,
  assignBadge,
};
