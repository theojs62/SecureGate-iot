const { z } = require("zod");
const bcrypt = require("bcrypt");
const { pool } = require("../config/db");

const userCreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "security"]).default("security")
});

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

async function createUser(req, res) {
  const parsed = userCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

  const { firstName, lastName, email, password, role } = parsed.data;

  const existing = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
  if (existing.rows.length > 0) return res.status(409).json({ error: "Email already used" });

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, role, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
     RETURNING id`,
    [firstName, lastName, email, passwordHash, role]
  );
  res.status(201).json({ id: String(rows[0].id) });
}

async function deleteUser(req, res) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userRes = await client.query(
      "SELECT id, badge_id AS \"badgeId\" FROM users WHERE id = $1 LIMIT 1",
      [req.params.id]
    );
    const user = userRes.rows[0];
    if (!user) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, message: "User not found" });
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

// Badges
const badgeCreateSchema = z.object({
  uid: z.string().min(1),
  userId: z.string().min(1),
  active: z.boolean().optional()
});

async function listBadges(req, res) {
  const { rows } = await pool.query(
    `SELECT b.id AS _id, b.uid, b.owner_user_id AS "userId", b.role, b.is_active AS "isActive",
            b.created_at AS "createdAt", b.updated_at AS "updatedAt",
            CASE
              WHEN u.id IS NULL THEN NULL
              ELSE jsonb_build_object('_id', u.id, 'firstName', u.first_name, 'lastName', u.last_name, 'email', u.email, 'role', u.role)
            END AS "user"
     FROM badges b
     LEFT JOIN users u ON u.id = b.owner_user_id
     ORDER BY b.created_at DESC`
  );

  const mapped = rows.map(({ user, ...row }) => ({
    ...row,
    userId: user
  }));
  res.json(mapped);
}

async function createBadge(req, res) {
  const parsed = badgeCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const { uid, userId, active } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userRes = await client.query(
      "SELECT id, badge_id AS \"badgeId\" FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );
    if (!user) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }

    const existingUid = await client.query("SELECT id FROM badges WHERE uid = $1 LIMIT 1", [uid]);
    if (existingUid.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Badge UID already exists" });
    }

    if (user.badgeId) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "User already has a badge" });
    }

    const badgeRes = await client.query(
      `INSERT INTO badges (uid, owner_user_id, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,NOW(),NOW())
       RETURNING id`,
      [uid, user.id, active ?? true]
    );

    const badgeId = badgeRes.rows[0].id;
    await client.query("UPDATE users SET badge_id = $1, updated_at = NOW() WHERE id = $2", [badgeId, user.id]);

    const out = await client.query(
      `SELECT b.id AS _id, b.uid, b.owner_user_id AS "userId", b.is_active AS "isActive",
              b.created_at AS "createdAt", b.updated_at AS "updatedAt",
              CASE
                WHEN u.id IS NULL THEN NULL
                ELSE jsonb_build_object('_id', u.id, 'firstName', u.first_name, 'lastName', u.last_name, 'email', u.email, 'role', u.role)
              END AS "user"
       FROM badges b
       LEFT JOIN users u ON u.id = b.owner_user_id
       WHERE b.id = $1`,
      [badgeId]
    );

    await client.query("COMMIT");
    const { user, ...rest } = out.rows[0];
    res.status(201).json({ ...rest, userId: user });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


async function setBadgeActive(req, res) {
  const { active } = req.body;
  const { rows } = await pool.query(
    `UPDATE badges
     SET is_active = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id AS _id, uid, owner_user_id AS "userId", is_active AS "isActive",
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [!!active, req.params.id]
  );
  res.json(rows[0]);
}

// Zones
const zoneSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  entryPolicy: z.enum(["badgeOnly", "badge+presence"]).optional()
});

async function listZones(req, res) {
  const { rows } = await pool.query(
    `SELECT id AS _id, name, description, entry_policy AS "entryPolicy",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM zones
     ORDER BY name ASC`
  );
  res.json(rows);
}

async function createZone(req, res) {
  const parsed = zoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  const { name, description, entryPolicy } = parsed.data;
  const { rows } = await pool.query(
    `INSERT INTO zones (name, description, entry_policy, created_at, updated_at)
     VALUES ($1,$2,$3,NOW(),NOW())
     RETURNING id AS _id, name, description, entry_policy AS "entryPolicy",
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [name, description || "", entryPolicy || "badge+presence"]
  );
  res.status(201).json(rows[0]);
}

// Sensors
const sensorSchema = z.object({
  serial: z.string().min(1),
  zoneId: z.string().min(1),
  active: z.boolean().optional()
});

async function listSensors(req, res) {
  const { rows } = await pool.query(
    `SELECT s.id AS _id, s.serial, s.type, s.zone_id AS "zoneId", s.active,
            s.last_seen_at AS "lastSeenAt", s.created_at AS "createdAt", s.updated_at AS "updatedAt",
            CASE
              WHEN z.id IS NULL THEN NULL
              ELSE jsonb_build_object('_id', z.id, 'name', z.name)
            END AS "zone"
     FROM sensors s
     LEFT JOIN zones z ON z.id = s.zone_id
     ORDER BY s.created_at DESC`
  );

  const mapped = rows.map(({ zone, ...row }) => ({
    ...row,
    zoneId: zone
  }));
  res.json(mapped);
}

async function createSensor(req, res) {
  const parsed = sensorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  const { rows } = await pool.query(
    `INSERT INTO sensors (serial, zone_id, active, created_at, updated_at)
     VALUES ($1,$2,$3,NOW(),NOW())
     RETURNING id AS _id, serial, zone_id AS "zoneId", active, type,
               last_seen_at AS "lastSeenAt", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [parsed.data.serial, parsed.data.zoneId, parsed.data.active ?? true]
  );
  res.status(201).json(rows[0]);
}

module.exports = {
  listUsers, createUser, deleteUser,
  listBadges, createBadge, setBadgeActive,
  listZones, createZone,
  listSensors, createSensor
};
