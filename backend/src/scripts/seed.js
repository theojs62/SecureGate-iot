require("dotenv").config();
const bcrypt = require("bcrypt");
const { connectDB, pool } = require("../config/db");

async function run() {
  await connectDB();

  const adminEmail = "admin@cesi.fr";
  const securityEmail = "security@cesi.fr";

  let admin = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [adminEmail]);
  if (admin.rows.length === 0) {
    await pool.query(
      `INSERT INTO users (first_name, last_name, email, role, password_hash, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW())`,
      ["Admin", "CESI", adminEmail, "admin", await bcrypt.hash("admin123", 10)]
    );
    console.log("✅ Admin créé:", adminEmail, "mdp: admin123");
  }

  let sec = await pool.query("SELECT id, badge_id AS \"badgeId\" FROM users WHERE email = $1 LIMIT 1", [securityEmail]);
  if (sec.rows.length === 0) {
    const secRes = await pool.query(
      `INSERT INTO users (first_name, last_name, email, role, password_hash, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
       RETURNING id`,
      ["Security", "CESI", securityEmail, "security", await bcrypt.hash("security123", 10)]
    );
    sec = { rows: [{ id: secRes.rows[0].id, badgeId: null }] };
    console.log("✅ Security créé:", securityEmail, "mdp: security123");
  }

  let zone = await pool.query("SELECT id, name FROM zones WHERE name = $1 LIMIT 1", ["Entrée Principale"]);
  if (zone.rows.length === 0) {
    const zoneRes = await pool.query(
      `INSERT INTO zones (name, description, entry_policy, created_at, updated_at)
       VALUES ($1,$2,$3,NOW(),NOW())
       RETURNING id, name`,
      ["Entrée Principale", "Accès principal", "badge+presence"]
    );
    zone = zoneRes;
    console.log("✅ Zone créée:", zone.rows[0].name);
  }

  let sensor = await pool.query("SELECT id FROM sensors WHERE serial = $1 LIMIT 1", ["SENS-001"]);
  if (sensor.rows.length === 0) {
    await pool.query(
      `INSERT INTO sensors (serial, zone_id, active, created_at, updated_at)
       VALUES ($1,$2,$3,NOW(),NOW())`,
      ["SENS-001", zone.rows[0].id, true]
    );
    console.log("✅ Capteur créé:", "SENS-001");
  }

  let badge = await pool.query("SELECT id FROM badges WHERE uid = $1 LIMIT 1", ["BADGE-0001"]);
  if (badge.rows.length === 0) {
    const badgeRes = await pool.query(
      `INSERT INTO badges (uid, owner_user_id, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,NOW(),NOW())
       RETURNING id`,
      ["BADGE-0001", sec.rows[0].id, true]
    );
    await pool.query("UPDATE users SET badge_id = $1, updated_at = NOW() WHERE id = $2", [
      badgeRes.rows[0].id,
      sec.rows[0].id,
    ]);
    console.log("✅ Badge créé: BADGE-0001 -> security@cesi.fr");
  }

  console.log("✅ Seed terminé");
  await pool.end();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
