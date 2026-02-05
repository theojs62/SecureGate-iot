const BadgeModel = require("../models/badge.model");
const { pool } = require("../config/db");

function isValidBadgeType(t) {
  return t === "permanent" || t === "temporary";
}

async function listBadges(req, res) {
  const limit = Number(req.query.limit || 200);
  const rows = await BadgeModel.list({ limit });
  res.json(rows);
}

async function createBadge(req, res) {
  const { uid, ownerUserId = null, type = "permanent", expiresAt = null, isActive = true } = req.body;

  if (!uid || typeof uid !== "string") return res.status(400).json({ error: "uid is required" });
  if (!isValidBadgeType(type)) return res.status(400).json({ error: "type must be permanent|temporary" });

  // si ownerUserId est fourni, vérifier qu'il existe
  if (ownerUserId !== null) {
    const check = await pool.query(`SELECT id FROM users WHERE id=$1 LIMIT 1`, [Number(ownerUserId)]);
    if (check.rows.length === 0) return res.status(400).json({ error: "ownerUserId not found" });
  }

  // si temporary, expiresAt requis
  if (type === "temporary" && !expiresAt) {
    return res.status(400).json({ error: "expiresAt required for temporary badge" });
  }

  // convertir expiresAt ISO -> Date côté pg
  const expiresAtValue = expiresAt ? new Date(expiresAt) : null;

  const badge = await BadgeModel.create({
    uid: uid.trim(),
    ownerUserId: ownerUserId === null ? null : Number(ownerUserId),
    type,
    expiresAt: expiresAtValue,
    isActive: !!isActive
  });

  res.status(201).json(badge);
}


function toBigIntOrNull(v) {
  if (v === null || v === undefined) return null;
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function assignBadge(req, res) {
  const id = toBigIntOrNull(req.params.id);
  if (id === null) return res.status(400).json({ error: "invalid badge id" });

  const ownerUserId = toBigIntOrNull(req.body.ownerUserId);

  // si ownerUserId est fourni, vérifier qu'il existe
  if (ownerUserId !== null) {
    const check = await pool.query(`SELECT id FROM users WHERE id=$1 LIMIT 1`, [ownerUserId]);
    if (check.rows.length === 0) return res.status(400).json({ error: "ownerUserId not found" });
  }

  const badge = await BadgeModel.updateOwner({ id, ownerUserId });
  if (!badge) return res.status(404).json({ error: "badge not found" });

  res.json(badge);
}


function toBigIntOr400(res, v, name = "id") {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    res.status(400).json({ error: `invalid ${name}` });
    return null;
  }
  return n;
}

async function setBadgeActive(req, res) {
  const id = toBigIntOr400(res, req.params.id, "badge id");
  if (id === null) return;

  const isActive = !!req.body.isActive;

  const badge = await BadgeModel.setActive({ id, isActive });
  if (!badge) return res.status(404).json({ error: "badge not found" });

  res.json(badge);
}

module.exports = { listBadges, createBadge, assignBadge, setBadgeActive };
