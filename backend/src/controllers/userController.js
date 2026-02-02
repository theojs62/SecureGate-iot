const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");

async function createUser(req, res) {
  const { firstName, lastName, email, password, role, badgeUid, badgeId } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: "firstName, lastName, email, password requis" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [normalizedEmail]);
  if (existing.rows.length > 0) return res.status(409).json({ message: "Email déjà utilisé" });

  const passwordHash = await bcrypt.hash(password, 10);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let badge = null;
    if (badgeId) {
      const badgeRes = await client.query(
        `SELECT id, owner_user_id AS "ownerUserId", uid, is_active AS "isActive", role
         FROM badges WHERE id = $1 LIMIT 1`,
        [badgeId]
      );
      badge = badgeRes.rows[0] || null;
      if (!badge) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Badge introuvable (badgeId)" });
      }
    } else if (badgeUid) {
      const badgeRes = await client.query(
        `SELECT id, owner_user_id AS "ownerUserId", uid, is_active AS "isActive", role
         FROM badges WHERE uid = $1 LIMIT 1`,
        [badgeUid.trim()]
      );
      badge = badgeRes.rows[0] || null;
      if (!badge) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Badge introuvable (badgeUid)" });
      }
    }

    if (badge && badge.ownerUserId) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Ce badge est déjà assigné à un user" });
    }

    const userRes = await client.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, badge_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
       RETURNING id`,
      [
        firstName.trim(),
        lastName.trim(),
        normalizedEmail,
        passwordHash,
        role || "user",
        badge ? badge.id : null,
      ]
    );

    const userId = userRes.rows[0].id;

    if (badge) {
      await client.query(
        "UPDATE badges SET owner_user_id=$1, updated_at=NOW() WHERE id=$2",
        [userId, badge.id]
      );
    }

    const outRes = await client.query(
      `SELECT u.id AS _id, u.first_name AS "firstName", u.last_name AS "lastName", u.email, u.role,
              u.created_at AS "createdAt", u.updated_at AS "updatedAt",
              CASE
                WHEN b.id IS NULL THEN NULL
                ELSE jsonb_build_object('_id', b.id, 'uid', b.uid, 'isActive', b.is_active, 'role', b.role)
              END AS "badgeId"
       FROM users u
       LEFT JOIN badges b ON b.id = u.badge_id
       WHERE u.id = $1`,
      [userId]
    );

    await client.query("COMMIT");
    res.status(201).json(outRes.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listUsers(req, res) {
  const { rows } = await pool.query(
    `SELECT u.id AS _id, u.first_name AS "firstName", u.last_name AS "lastName", u.email, u.role,
            u.created_at AS "createdAt", u.updated_at AS "updatedAt",
            CASE
              WHEN b.id IS NULL THEN NULL
              ELSE jsonb_build_object('_id', b.id, 'uid', b.uid, 'isActive', b.is_active, 'role', b.role)
            END AS "badgeId"
     FROM users u
     LEFT JOIN badges b ON b.id = u.badge_id
     ORDER BY u.created_at DESC`
  );

  res.json(rows);
}

async function setUserBadge(req, res) {
  const { id } = req.params;
  const { badgeId, badgeUid } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userRes = await client.query(
      `SELECT id, badge_id AS "badgeId"
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    const user = userRes.rows[0];
    if (!user) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User introuvable" });
    }

    if (user.badgeId) {
      await client.query(
        "UPDATE badges SET owner_user_id = NULL, updated_at = NOW() WHERE id = $1 AND owner_user_id = $2",
        [user.badgeId, user.id]
      );
      await client.query("UPDATE users SET badge_id = NULL, updated_at = NOW() WHERE id = $1", [user.id]);
    }

    if (badgeId === null) {
      const outNull = await client.query(
        `SELECT u.id AS _id, u.first_name AS "firstName", u.last_name AS "lastName", u.email, u.role,
                u.created_at AS "createdAt", u.updated_at AS "updatedAt",
                CASE
                  WHEN b.id IS NULL THEN NULL
                  ELSE jsonb_build_object('_id', b.id, 'uid', b.uid, 'isActive', b.is_active, 'role', b.role)
                END AS "badgeId"
         FROM users u
         LEFT JOIN badges b ON b.id = u.badge_id
         WHERE u.id = $1`,
        [user.id]
      );
      await client.query("COMMIT");
      return res.json(outNull.rows[0]);
    }

    let badge = null;
    if (badgeId) {
      const badgeRes = await client.query(
        `SELECT id, owner_user_id AS "ownerUserId", uid, is_active AS "isActive", role
         FROM badges WHERE id = $1 LIMIT 1`,
        [badgeId]
      );
      badge = badgeRes.rows[0] || null;
      if (!badge) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Badge introuvable (badgeId)" });
      }
    } else if (badgeUid) {
      const badgeRes = await client.query(
        `SELECT id, owner_user_id AS "ownerUserId", uid, is_active AS "isActive", role
         FROM badges WHERE uid = $1 LIMIT 1`,
        [badgeUid.trim()]
      );
      badge = badgeRes.rows[0] || null;
      if (!badge) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Badge introuvable (badgeUid)" });
      }
    } else {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "badgeId ou badgeUid requis (ou badgeId:null)" });
    }

    if (badge.ownerUserId) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Ce badge est déjà assigné" });
    }

    await client.query("UPDATE users SET badge_id = $1, updated_at = NOW() WHERE id = $2", [badge.id, user.id]);
    await client.query("UPDATE badges SET owner_user_id = $1, updated_at = NOW() WHERE id = $2", [user.id, badge.id]);

    const outRes = await client.query(
      `SELECT u.id AS _id, u.first_name AS "firstName", u.last_name AS "lastName", u.email, u.role,
              u.created_at AS "createdAt", u.updated_at AS "updatedAt",
              CASE
                WHEN b.id IS NULL THEN NULL
                ELSE jsonb_build_object('_id', b.id, 'uid', b.uid, 'isActive', b.is_active, 'role', b.role)
              END AS "badgeId"
       FROM users u
       LEFT JOIN badges b ON b.id = u.badge_id
       WHERE u.id = $1`,
      [user.id]
    );

    await client.query("COMMIT");
    res.json(outRes.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// DELETE /api/users/:id (optionnel)
async function deleteUser(req, res) {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userRes = await client.query(
      "SELECT id, badge_id AS \"badgeId\" FROM users WHERE id = $1 LIMIT 1",
      [id]
    );
    const user = userRes.rows[0];
    if (!user) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User introuvable" });
    }

    if (user.badgeId) {
      await client.query(
        "UPDATE badges SET owner_user_id = NULL, updated_at = NOW() WHERE id = $1 AND owner_user_id = $2",
        [user.badgeId, user.id]
      );
    }

    await client.query("DELETE FROM users WHERE id = $1", [user.id]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createUser, listUsers, setUserBadge, deleteUser };
