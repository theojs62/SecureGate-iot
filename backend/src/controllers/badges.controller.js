const crypto = require("crypto");
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

function buildEnrollSignature({ uid, hasExpiry, horaire }) {
  const secret = process.env.MQTT_ENROLL_SIGNATURE_SECRET || process.env.JWT_SECRET || "change-me";
  const data = `${uid}|${hasExpiry ? "yes" : "no"}|${horaire}`;
  return crypto.createHmac("sha256", secret).update(data).digest("hex").slice(0, 32);
}

function publishBadgeCreatedEvent(req, badge) {
  const client = req.app?.locals?.mqttClient;
  if (!client || !client.connected) {
    console.log("MQTT non connecté: événement de création badge non publié");
    return;
  }

  const topic = process.env.MQTT_ENROLL_RESPONSE_TOPIC || "CESI/Response/Enroll";
  const horaire = new Date().toISOString();
  const hasExpiry = Boolean(badge.expires_at);
  const signature = buildEnrollSignature({ uid: badge.uid, hasExpiry, horaire });

  const payload = JSON.stringify({
    uid: badge.uid,
    signature,
    badgeId: String(badge.id),
    type: badge.badge_type,
    expiresAt: badge.expires_at,
    horaire
  });

  client.publish(topic, payload, { qos: 1, retain: false }, (err) => {
    if (err) {
      console.error(" MQTT publish badge create error:", err.message);
      return;
    }
    console.log(` MQTT enroll response envoyé → ${topic} ${payload}`);
  });
}

async function getEnrollRequest(req, res) {
  const enroll = req.app?.locals?.latestEnrollRequest || null;
  res.json(enroll);
}

async function consumeEnrollRequest(req, res) {
  req.app.locals.latestEnrollRequest = null;
  res.json({ ok: true });
}

async function createBadge(req, res) {
  const { uid, ownerUserId = null, type = "permanent", expiresAt = null } = req.body;

  if (!uid || typeof uid !== "string") return res.status(400).json({ error: "uid is required" });
  if (!isValidBadgeType(type)) return res.status(400).json({ error: "type must be permanent|temporary" });

  if (ownerUserId !== null) {
    const check = await pool.query(`SELECT id FROM users WHERE id=$1 LIMIT 1`, [Number(ownerUserId)]);
    if (check.rows.length === 0) return res.status(400).json({ error: "ownerUserId not found" });
  }

  if (type === "temporary" && !expiresAt) {
    return res.status(400).json({ error: "expiresAt required for temporary badge" });
  }

  const expiresAtValue = expiresAt ? new Date(expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAtValue.getTime())) {
    return res.status(400).json({ error: "expiresAt must be a valid datetime" });
  }
  if (type === "temporary" && expiresAtValue <= new Date()) {
    return res.status(400).json({ error: "expiresAt must be in the future for temporary badge" });
  }

  const badge = await BadgeModel.create({
    uid: uid.trim(),
    ownerUserId: ownerUserId === null ? null : Number(ownerUserId),
    type,
    expiresAt: expiresAtValue
  });

  publishBadgeCreatedEvent(req, badge);

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

  if (ownerUserId !== null) {
    const check = await pool.query(`SELECT id FROM users WHERE id=$1 LIMIT 1`, [ownerUserId]);
    if (check.rows.length === 0) return res.status(400).json({ error: "ownerUserId not found" });
  }

  const badge = await BadgeModel.updateOwner({ id, ownerUserId });
  if (!badge) return res.status(404).json({ error: "badge not found" });

  res.json(badge);
}

async function deleteBadge(req, res) {
  const id = toBigIntOrNull(req.params.id);
  if (id === null) return res.status(400).json({ error: "invalid badge id" });

  const badge = await BadgeModel.remove({ id });
  if (!badge) return res.status(404).json({ error: "badge not found" });

  return res.status(204).send();
}

module.exports = { listBadges, createBadge, assignBadge, deleteBadge, getEnrollRequest, consumeEnrollRequest };