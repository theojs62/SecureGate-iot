const { pool } = require("../config/db");

async function getPendingInterphone(req, res) {
  const { rows } = await pool.query(
    `SELECT *
     FROM interphone_requests
     WHERE status='PENDING'
     ORDER BY created_at DESC
     LIMIT 1`
  );
  return res.json(rows[0] || null);
}

async function respondInterphone(req, res) {
  const { autorise } = req.body;

  if (typeof autorise !== "boolean") {
    return res.status(400).json({ error: "autorise must be boolean" });
  }

  const client = req.app.locals.mqttClient;
  if (!client || !client.connected) {
    return res.status(503).json({ error: "MQTT not connected" });
  }

  // ✅ trouver la demande PENDING la plus récente
  const pending = await pool.query(
    `SELECT id
     FROM interphone_requests
     WHERE status='PENDING'
     ORDER BY created_at DESC
     LIMIT 1`
  );

  if (pending.rows.length === 0) {
    return res.status(404).json({ error: "no pending interphone request" });
  }

  const requestId = pending.rows[0].id;
  const userId = req.user?.sub ? Number(req.user.sub) : null;

  // ✅ publish MQTT
  const payload = JSON.stringify({ autorise });
  client.publish("CESI/Response/Interphone", payload, { qos: 1, retain: false });

  // ✅ marquer la demande traitée
  await pool.query(
    `UPDATE interphone_requests
     SET status=$2, decided_by=$3, decided_at=NOW()
     WHERE id=$1`,
    [requestId, autorise ? "ACCEPTED" : "REFUSED", userId]
  );

  // (optionnel) audit
  try {
    await pool.query(
      `INSERT INTO interphone_events (autorise, decided_by)
       VALUES ($1, $2)`,
      [autorise, userId]
    );
  } catch (e) {
    console.error("⚠️ interphone_events insert failed:", e.message);
  }

  return res.json({ ok: true, requestId, published: payload });
}

module.exports = { getPendingInterphone, respondInterphone };
