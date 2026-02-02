const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Badge = require("../models/Badge");

async function createUser(req, res) {
  const { firstName, lastName, email, password, role, badgeUid, badgeId } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: "firstName, lastName, email, password requis" });
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() }).lean();
  if (existing) return res.status(409).json({ message: "Email déjà utilisé" });

  const passwordHash = await bcrypt.hash(password, 10);

  let badge = null;
  if (badgeId) {
    badge = await Badge.findById(badgeId);
    if (!badge) return res.status(404).json({ message: "Badge introuvable (badgeId)" });
  } else if (badgeUid) {
    badge = await Badge.findOne({ uid: badgeUid.trim() });
    if (!badge) return res.status(404).json({ message: "Badge introuvable (badgeUid)" });
  }

  if (badge && badge.ownerUserId) {
    return res.status(409).json({ message: "Ce badge est déjà assigné à un user" });
  }

  const user = await User.create({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role: role || "user",
    badgeId: badge ? badge._id : null,
  });

  if (badge) {
    badge.ownerUserId = user._id;
    await badge.save();
  }

  const out = await User.findById(user._id)
    .populate("badgeId", "uid isActive role")
    .lean();

  res.status(201).json(out);
}

async function listUsers(req, res) {
  const rows = await User.find()
    .sort({ createdAt: -1 })
    .populate("badgeId", "uid isActive role")
    .lean();

  // masque passwordHash
  const safe = rows.map(({ passwordHash, ...u }) => u);
  res.json(safe);
}

async function setUserBadge(req, res) {
  const { id } = req.params;
  const { badgeId, badgeUid } = req.body;

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: "User introuvable" });

  if (user.badgeId) {
    await Badge.updateOne({ _id: user.badgeId, ownerUserId: user._id }, { $set: { ownerUserId: null } });
    user.badgeId = null;
  }

 
  if (badgeId === null) {
    await user.save();
    const outNull = await User.findById(user._id).populate("badgeId", "uid isActive role").lean();
    const { passwordHash, ...safeNull } = outNull;
    return res.json(safeNull);
  }

  // trouver badge à assigner
  let badge = null;
  if (badgeId) {
    badge = await Badge.findById(badgeId);
    if (!badge) return res.status(404).json({ message: "Badge introuvable (badgeId)" });
  } else if (badgeUid) {
    badge = await Badge.findOne({ uid: badgeUid.trim() });
    if (!badge) return res.status(404).json({ message: "Badge introuvable (badgeUid)" });
  } else {
    return res.status(400).json({ message: "badgeId ou badgeUid requis (ou badgeId:null)" });
  }

  if (badge.ownerUserId) return res.status(409).json({ message: "Ce badge est déjà assigné" });

  user.badgeId = badge._id;
  await user.save();

  badge.ownerUserId = user._id;
  await badge.save();

  const out = await User.findById(user._id).populate("badgeId", "uid isActive role").lean();
  const { passwordHash, ...safe } = out;
  res.json(safe);
}

// DELETE /api/users/:id (optionnel)
async function deleteUser(req, res) {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: "User introuvable" });

  // unlink badge
  if (user.badgeId) {
    await Badge.updateOne({ _id: user.badgeId, ownerUserId: user._id }, { $set: { ownerUserId: null } });
  }

  await user.deleteOne();
  res.json({ ok: true });
}

module.exports = { createUser, listUsers, setUserBadge, deleteUser };
