const { z } = require("zod");
const { pool } = require("../config/db");
const { createAlert } = require("../services/alertService");

const badgeScanSchema = z.object({
  badgeUid: z.string().min(1),
  zoneId: z.string().min(1),
  direction: z.enum(["IN", "OUT"])
});

async function badgeScan(req, res) {
  const parsed = badgeScanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const { badgeUid, zoneId, direction } = parsed.data;

  const badgeRes = await pool.query(
    `SELECT id, owner_user_id AS "ownerUserId", is_active AS "isActive"
     FROM badges
     WHERE uid = $1
     LIMIT 1`,
    [badgeUid]
  );
  const badge = badgeRes.rows[0] || null;
  const zoneRes = await pool.query(
    "SELECT id, name FROM zones WHERE id = $1 LIMIT 1",
    [zoneId]
  );
  const zone = zoneRes.rows[0] || null;
  if (!zone) return res.status(404).json({ error: "Zone not found" });

  let status = "DENIED";
  let reason = "Badge inconnu";
  let userId = null;

  if (badge) {
    userId = badge.ownerUserId;
    if (!badge.isActive) {
      reason = "Badge inactif";
    } else {
      status = "GRANTED";
      reason = "OK";
    }
  }

  const logRes = await pool.query(
    `INSERT INTO access_logs (badge_uid, user_id, zone_id, direction, status, reason, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
     RETURNING id AS _id, badge_uid AS "badgeUid", user_id AS "userId",
               zone_id AS "zoneId", direction, status, reason,
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [badgeUid, userId, zoneId, direction, status, reason]
  );
  const log = logRes.rows[0];

  // Alerte si refus
  if (status === "DENIED") {
    await createAlert({
      mailer: req.app.locals.mailer,
      type: "DENIED_BADGE",
      severity: "MEDIUM",
      zoneId,
      relatedUserId: userId,
      relatedBadgeUid: badgeUid,
      message: `Badge refusé en zone "${zone.name}" (${reason})`
    });
  }

  res.status(201).json(log);
}

const presenceSchema = z.object({
  sensorSerial: z.string().min(1),
  detected: z.boolean()
});

async function presence(req, res) {
  const parsed = presenceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const { sensorSerial, detected } = parsed.data;

  const sensorRes = await pool.query(
    `SELECT id, zone_id AS "zoneId" FROM sensors WHERE serial = $1 LIMIT 1`,
    [sensorSerial]
  );
  const sensor = sensorRes.rows[0] || null;
  if (!sensor) return res.status(404).json({ error: "Sensor not found" });

  await pool.query("UPDATE sensors SET last_seen_at = NOW(), updated_at = NOW() WHERE id = $1", [sensor.id]);

  const peRes = await pool.query(
    `INSERT INTO presence_events (sensor_id, zone_id, detected, created_at, updated_at)
     VALUES ($1,$2,$3,NOW(),NOW())
     RETURNING id AS _id, sensor_id AS "sensorId", zone_id AS "zoneId",
               detected, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [sensor.id, sensor.zoneId, detected]
  );
  const pe = peRes.rows[0];

  // Si présence détectée -> vérifier badge récent GRANTED IN dans la même zone
  if (detected) {
    const windowMs = Number(process.env.PRESENCE_BADGE_WINDOW_MS || 120000);
    const since = new Date(Date.now() - windowMs);

    const recentGrantedRes = await pool.query(
      `SELECT id FROM access_logs
       WHERE zone_id = $1 AND status = 'GRANTED' AND direction = 'IN' AND created_at >= $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [sensor.zoneId, since]
    );
    const recentGranted = recentGrantedRes.rows[0] || null;

    if (!recentGranted) {
      const zoneRes = await pool.query("SELECT name FROM zones WHERE id = $1 LIMIT 1", [sensor.zoneId]);
      const zone = zoneRes.rows[0] || null;
      await createAlert({
        mailer: req.app.locals.mailer,
        type: "NO_BADGE_PRESENCE",
        severity: "HIGH",
        zoneId: sensor.zoneId,
        relatedUserId: null,
        relatedBadgeUid: null,
        message: `Présence détectée en zone "${zone?.name || "?"}" sans badge valide récent`
      });
    }
  }

  res.status(201).json(pe);
}

module.exports = { badgeScan, presence };
