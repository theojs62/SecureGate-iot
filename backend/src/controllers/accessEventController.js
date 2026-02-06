const { pool } = require("../config/db");

async function listAccessEvents(req, res) {
  const limit = Math.min(Number(req.query.limit || 100), 500);

  const { rows } = await pool.query(
    `SELECT ae.id AS _id,
            ae.badge_uid AS "badgeUid",
            ae.result,
            ae.created_at AS "createdAt",
            CASE
              WHEN u.id IS NULL THEN NULL
              ELSE jsonb_build_object('_id', u.id, 'firstName', u.first_name, 'lastName', u.last_name, 'email', u.email)
            END AS "userId",
            CASE
              WHEN b.id IS NULL THEN NULL
              ELSE jsonb_build_object('_id', b.id, 'uid', b.uid)
            END AS "badgeId"
     FROM access_events ae
     LEFT JOIN badges b ON b.id = ae.badge_id
     LEFT JOIN users u ON u.id = COALESCE(ae.user_id, b.owner_user_id)
     ORDER BY ae.created_at DESC
     LIMIT $1`,
    [limit]
  );

  res.json(rows);
}

module.exports = { listAccessEvents };
