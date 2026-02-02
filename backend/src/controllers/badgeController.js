const { pool } = require("../config/db");

// POST /api/badges
async function createBadge(req, res) {
  const { uid, ownerUserId, role, isActive } = req.body;

  if (!uid || typeof uid !== "string" || !uid.trim()) {
    return res.status(400).json({ message: "uid requis" });
  }

  const existing = await pool.query("SELECT id FROM badges WHERE uid = $1 LIMIT 1", [uid.trim()]);
  if (existing.rows.length > 0) return res.status(409).json({ message: "Ce badge UID existe déjà" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let user = null;
    if (ownerUserId) {
      const userRes = await client.query(
        "SELECT id, badge_id AS \"badgeId\" FROM users WHERE id = $1 LIMIT 1",
        [ownerUserId]
      );
      user = userRes.rows[0] || null;
      if (!user) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "User introuvable" });
      }
      if (user.badgeId) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Ce user a déjà un badge" });
      }
    }

    const badgeRes = await client.query(
      `INSERT INTO badges (uid, owner_user_id, role, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,NOW(),NOW())
       RETURNING id, uid, owner_user_id AS "ownerUserId", role, is_active AS "isActive",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [uid.trim(), ownerUserId || null, role || "user", typeof isActive === "boolean" ? isActive : true]
    );
    const { id: badgeIdValue, ...badgeRow } = badgeRes.rows[0];
    const badge = { _id: badgeIdValue, ...badgeRow };

    if (user) {
      await client.query("UPDATE users SET badge_id = $1, updated_at = NOW() WHERE id = $2", [badge._id, user.id]);
    }

    await client.query("COMMIT");
    return res.status(201).json(badge);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// GET /api/badges
async function listBadges(req, res) {
  const { rows } = await pool.query(
    `SELECT b.id AS _id, b.uid, b.owner_user_id AS "ownerUserId", b.role, b.is_active AS "isActive",
            b.created_at AS "createdAt", b.updated_at AS "updatedAt",
            CASE
              WHEN u.id IS NULL THEN NULL
              ELSE jsonb_build_object('_id', u.id, 'firstName', u.first_name, 'lastName', u.last_name, 'email', u.email)
            END AS "ownerUser"
     FROM badges b
     LEFT JOIN users u ON u.id = b.owner_user_id
     ORDER BY b.created_at DESC`
  );

  const mapped = rows.map(({ ownerUser, ...row }) => ({
    ...row,
    ownerUserId: ownerUser,
  }));

  res.json(mapped);
}

// DELETE /api/badges/:id
async function deleteBadge(req, res) {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const badgeRes = await client.query(
      "SELECT id, owner_user_id AS \"ownerUserId\" FROM badges WHERE id = $1 LIMIT 1",
      [id]
    );
    const badge = badgeRes.rows[0];
    if (!badge) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Badge introuvable" });
    }

    if (badge.ownerUserId) {
      await client.query(
        "UPDATE users SET badge_id = NULL, updated_at = NOW() WHERE id = $1 AND badge_id = $2",
        [badge.ownerUserId, badge.id]
      );
    }

    await client.query("DELETE FROM badges WHERE id = $1", [badge.id]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// PATCH /api/badges/:id/assign
async function assignBadge(req, res) {
  const { id } = req.params;
  const { ownerUserId } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const badgeRes = await client.query(
      "SELECT id, owner_user_id AS \"ownerUserId\" FROM badges WHERE id = $1 LIMIT 1",
      [id]
    );
    const badge = badgeRes.rows[0];
    if (!badge) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Badge introuvable" });
    }

    if (badge.ownerUserId) {
      await client.query(
        "UPDATE users SET badge_id = NULL, updated_at = NOW() WHERE id = $1 AND badge_id = $2",
        [badge.ownerUserId, badge.id]
      );
    }

    if (ownerUserId) {
      const userRes = await client.query(
        "SELECT id, badge_id AS \"badgeId\" FROM users WHERE id = $1 LIMIT 1",
        [ownerUserId]
      );
      const user = userRes.rows[0];
      if (!user) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "User introuvable" });
      }
      if (user.badgeId) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Ce user a déjà un badge" });
      }

      await client.query("UPDATE badges SET owner_user_id = $1, updated_at = NOW() WHERE id = $2", [user.id, badge.id]);
      await client.query("UPDATE users SET badge_id = $1, updated_at = NOW() WHERE id = $2", [badge.id, user.id]);
    } else {
      await client.query("UPDATE badges SET owner_user_id = NULL, updated_at = NOW() WHERE id = $1", [badge.id]);
    }

    const outRes = await client.query(
      `SELECT b.id AS _id, b.uid, b.owner_user_id AS "ownerUserId", b.role, b.is_active AS "isActive",
              b.created_at AS "createdAt", b.updated_at AS "updatedAt",
              CASE
                WHEN u.id IS NULL THEN NULL
                ELSE jsonb_build_object('_id', u.id, 'firstName', u.first_name, 'lastName', u.last_name, 'email', u.email)
              END AS "ownerUser"
       FROM badges b
       LEFT JOIN users u ON u.id = b.owner_user_id
       WHERE b.id = $1`,
      [badge.id]
    );

    await client.query("COMMIT");
    const { ownerUser, ...rest } = outRes.rows[0];
    res.json({ ...rest, ownerUserId: ownerUser });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createBadge,
  listBadges,
  deleteBadge,
  assignBadge,
};
