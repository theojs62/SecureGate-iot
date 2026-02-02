const { pool } = require("../config/db");

async function overview(req, res) {
  const since = startOfDay(new Date());
  const [openAlertsRes, todayAccessRes, zonesRes] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS count FROM alerts WHERE status = 'OPEN'"),
    pool.query("SELECT COUNT(*)::int AS count FROM access_logs WHERE created_at >= $1", [since]),
    pool.query("SELECT id, name FROM zones")
  ]);

  const zones = zonesRes.rows;

  const topZonesAgg = await pool.query(
    `SELECT zone_id AS "zoneId", COUNT(*)::int AS count
     FROM access_logs
     WHERE created_at >= $1
     GROUP BY zone_id
     ORDER BY count DESC
     LIMIT 5`,
    [since]
  );

  const zoneMap = new Map(zones.map((z) => [String(z.id), z.name]));
  const topZones = topZonesAgg.rows.map((z) => ({
    zoneId: String(z.zoneId),
    zoneName: zoneMap.get(String(z.zoneId)) || "?",
    count: z.count
  }));

  res.json({
    kpis: {
      openAlerts: openAlertsRes.rows[0].count,
      todayAccess: todayAccessRes.rows[0].count
    },
    topZones
  });
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function presence(req, res) {
  const logsRes = await pool.query(
    `SELECT DISTINCT ON (user_id) user_id AS "userId",
            direction AS "lastDirection",
            zone_id AS "lastZoneId",
            created_at AS "lastAt"
     FROM access_logs
     WHERE status = 'GRANTED' AND user_id IS NOT NULL
     ORDER BY user_id, created_at DESC`
  );

  const present = logsRes.rows.filter((log) => log.lastDirection === "IN");
  const userIds = present.map((p) => p.userId);
  const zoneIds = present.map((p) => p.lastZoneId);

  const [usersRes, zonesRes] = await Promise.all([
    userIds.length
      ? pool.query(
          `SELECT id AS _id, first_name AS "firstName", last_name AS "lastName", email, role
           FROM users
           WHERE id = ANY($1::bigint[])`,
          [userIds]
        )
      : { rows: [] },
    zoneIds.length
      ? pool.query(
          `SELECT id AS _id, name, description, entry_policy AS "entryPolicy"
           FROM zones
           WHERE id = ANY($1::bigint[])`,
          [zoneIds]
        )
      : { rows: [] }
  ]);

  const userMap = new Map(usersRes.rows.map((u) => [String(u._id), u]));
  const zoneMap = new Map(zonesRes.rows.map((z) => [String(z._id), z]));

  res.json(
    present.map((p) => ({
      user: userMap.get(String(p.userId)),
      zone: zoneMap.get(String(p.lastZoneId)),
      lastAt: p.lastAt
    }))
  );
}

async function accessLogs(req, res) {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const { rows } = await pool.query(
    `SELECT al.id AS _id, al.badge_uid AS "badgeUid", al.direction, al.status, al.reason,
            al.created_at AS "createdAt", al.updated_at AS "updatedAt",
            CASE
              WHEN u.id IS NULL THEN NULL
              ELSE jsonb_build_object('_id', u.id, 'firstName', u.first_name, 'lastName', u.last_name, 'email', u.email, 'role', u.role)
            END AS "userId",
            CASE
              WHEN z.id IS NULL THEN NULL
              ELSE jsonb_build_object('_id', z.id, 'name', z.name)
            END AS "zoneId"
     FROM access_logs al
     LEFT JOIN users u ON u.id = al.user_id
     LEFT JOIN zones z ON z.id = al.zone_id
     ORDER BY al.created_at DESC
     LIMIT $1`,
    [limit]
  );

  res.json(rows);
}

async function alerts(req, res) {
  const status = req.query.status;
  const params = [];
  let where = "";
  if (status) {
    params.push(status);
    where = "WHERE a.status = $1";
  }

  const { rows } = await pool.query(
    `SELECT a.id AS _id, a.type, a.severity, a.zone_id AS "zoneId",
            a.related_user_id AS "relatedUserId", a.related_badge_uid AS "relatedBadgeUid",
            a.status, a.message, a.ack_by AS "ackBy", a.ack_at AS "ackAt",
            a.created_at AS "createdAt", a.updated_at AS "updatedAt",
            CASE
              WHEN z.id IS NULL THEN NULL
              ELSE jsonb_build_object('_id', z.id, 'name', z.name)
            END AS "zone",
            CASE
              WHEN u.id IS NULL THEN NULL
              ELSE jsonb_build_object('_id', u.id, 'firstName', u.first_name, 'lastName', u.last_name, 'email', u.email)
            END AS "relatedUser"
     FROM alerts a
     LEFT JOIN zones z ON z.id = a.zone_id
     LEFT JOIN users u ON u.id = a.related_user_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT 200`,
    params
  );

  const mapped = rows.map(({ zone, relatedUser, ...row }) => ({
    ...row,
    zoneId: zone,
    relatedUserId: relatedUser
  }));

  res.json(mapped);
}

async function ackAlert(req, res) {
  const id = req.params.id;
  const userId = req.user.sub;
  const { rows } = await pool.query(
    `UPDATE alerts
     SET status = 'ACK', ack_by = $1, ack_at = NOW(), updated_at = NOW()
     WHERE id = $2
     RETURNING id AS _id, type, severity, zone_id AS "zoneId", related_user_id AS "relatedUserId",
               related_badge_uid AS "relatedBadgeUid", status, message, ack_by AS "ackBy",
               ack_at AS "ackAt", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [userId, id]
  );

  res.json(rows[0]);
}

async function closeAlert(req, res) {
  const id = req.params.id;
  const { rows } = await pool.query(
    `UPDATE alerts
     SET status = 'CLOSED', updated_at = NOW()
     WHERE id = $1
     RETURNING id AS _id, type, severity, zone_id AS "zoneId", related_user_id AS "relatedUserId",
               related_badge_uid AS "relatedBadgeUid", status, message, ack_by AS "ackBy",
               ack_at AS "ackAt", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [id]
  );
  res.json(rows[0]);
}

module.exports = { overview, presence, accessLogs, alerts, ackAlert, closeAlert };
