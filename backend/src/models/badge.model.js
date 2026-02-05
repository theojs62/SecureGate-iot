const { pool } = require("../config/db");

async function list({ limit = 200 } = {}) {
  const { rows } = await pool.query(
    `SELECT
       b.*,
       u.email AS owner_email,
       (
         CASE
           WHEN b.badge_type = 'temporary' AND b.expires_at IS NOT NULL AND b.expires_at <= NOW() THEN FALSE
           ELSE TRUE
         END
       ) AS is_currently_active
     FROM badges b
     LEFT JOIN users u ON u.id = b.owner_user_id
     ORDER BY b.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

async function create({ uid, ownerUserId = null, type = "permanent", expiresAt = null }) {
  // règles simples
  if (type === "permanent") expiresAt = null;

  const { rows } = await pool.query(
    `INSERT INTO badges (uid, owner_user_id, badge_type, expires_at, is_active)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [uid, ownerUserId, type, expiresAt, true]
  );
  return rows[0];
}


async function updateOwner({ id, ownerUserId }) {
  if (!Number.isFinite(Number(id))) return null;

  // ownerUserId peut être null (désassigner)
  const val = ownerUserId === null ? null : Number(ownerUserId);
  if (ownerUserId !== null && !Number.isFinite(val)) return null;

  const { rows } = await pool.query(
    `UPDATE badges
     SET owner_user_id=$2, updated_at=NOW()
     WHERE id=$1
     RETURNING *`,
    [Number(id), val]
  );
  return rows[0] || null;
}

async function remove({ id }) {
  if (!Number.isFinite(Number(id))) return null;

  const { rows } = await pool.query(
    `DELETE FROM badges
     WHERE id = $1
     RETURNING *`,
    [Number(id)]
  );

  return rows[0] || null;
}


module.exports = { list, create, updateOwner, remove };