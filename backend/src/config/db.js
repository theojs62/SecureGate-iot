const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function ensureSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'security',
      badge_id BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS badges (
  id BIGSERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  owner_user_id BIGINT,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
`ALTER TABLE badges ADD COLUMN IF NOT EXISTS badge_type TEXT NOT NULL DEFAULT 'permanent'`,
`ALTER TABLE badges ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL`,
`CREATE INDEX IF NOT EXISTS badges_owner_user_id_idx ON badges(owner_user_id)`,
`CREATE INDEX IF NOT EXISTS badges_expires_at_idx ON badges(expires_at)`,
    `CREATE TABLE IF NOT EXISTS zones (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      entry_policy TEXT NOT NULL DEFAULT 'badge+presence',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS sensors (
      id BIGSERIAL PRIMARY KEY,
      serial TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'presence',
      zone_id BIGINT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
      active BOOLEAN NOT NULL DEFAULT true,
      last_seen_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS access_logs (
      id BIGSERIAL PRIMARY KEY,
      badge_uid TEXT NOT NULL,
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      zone_id BIGINT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
      direction TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS access_events (
      id BIGSERIAL PRIMARY KEY,
      badge_uid TEXT NOT NULL,
      result BOOLEAN NOT NULL,
      badge_id BIGINT REFERENCES badges(id) ON DELETE SET NULL,
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      topic TEXT DEFAULT 'CESI/action/entrer',
      device TEXT DEFAULT 'UNKNOWN',
      ts BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS presence_events (
      id BIGSERIAL PRIMARY KEY,
      sensor_id BIGINT NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
      zone_id BIGINT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
      detected BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS alerts (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'MEDIUM',
      zone_id BIGINT REFERENCES zones(id) ON DELETE SET NULL,
      related_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      related_badge_uid TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      message TEXT NOT NULL,
      ack_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      ack_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` ,
    `CREATE TABLE IF NOT EXISTS interphone_requests (
  id BIGSERIAL PRIMARY KEY,
  device TEXT NOT NULL DEFAULT 'UNKNOWN',
  payload JSONB NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','REFUSED')),
  decided_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)` ,

"CREATE INDEX IF NOT EXISTS interphone_requests_status_idx ON interphone_requests(status)",
"CREATE INDEX IF NOT EXISTS interphone_requests_created_idx ON interphone_requests(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS access_logs_created_at_idx ON access_logs (created_at DESC)",
    "CREATE INDEX IF NOT EXISTS access_logs_zone_idx ON access_logs (zone_id)",
    "CREATE INDEX IF NOT EXISTS access_events_created_at_idx ON access_events (created_at DESC)",
    "CREATE INDEX IF NOT EXISTS alerts_status_idx ON alerts (status)",
  ];

  for (const statement of statements) {
    await pool.query(statement);
  }
}

async function connectDB() {
  await pool.query("SELECT 1");
  await ensureSchema();
  console.log("✅ PostgreSQL connecté");
}

module.exports = { connectDB, pool };
