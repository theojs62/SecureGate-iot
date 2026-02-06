const mqtt = require("mqtt");
const { pool } = require("../config/db");
const { createAlert } = require("../services/alertService");

/**
 * Démarre le client MQTT et s'abonne aux topics CESI/#
 * @param {import("express").Express} app
 */
function startMqtt(app) {
  const url = process.env.MQTT_URL;
  if (!url) {
    console.log(" MQTT_URL vide -> MQTT désactivé");
    return null;
  }

  const rootTopic = process.env.MQTT_ROOT_TOPIC || "CESI/#";

  const client = mqtt.connect(url, {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clientId: "cesi-backend-" + Math.random().toString(16).slice(2),
    clean: true,
    reconnectPeriod: 2000
  });

  client.on("connect", () => {
    console.log("MQTT connecté:", url);

    client.subscribe(rootTopic, (err) => {
      if (err) console.error("MQTT subscribe error:", err.message);
      else console.log("📡 MQTT abonné à:", rootTopic);
    });
  });

  client.on("message", async (topic, messageBuf) => {
    const raw = messageBuf.toString("utf-8");

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw; // ex: "ON"/"OFF"
    }

    console.log("📨 MQTT", topic, data);

    try {
      await routeMqttMessage(app, client, topic, data);
    } catch (e) {
      console.error(" MQTT route error:", e.message);
    }
  });

  client.on("error", (err) => {
    console.error(" MQTT error:", err.message);
  });

  return client;
}

async function routeMqttMessage(app, client, topic, data) {
  // ========= STATUS =========
  if (topic === "CESI/Status/Capteur") return;
  if (topic === "CESI/Status/Porte") return;
  if (topic === "CESI/Status/Entrer") return;

  // ========= (OPTIONNEL) Ancien topic action/entre -> commande porte =========
  // Si tu veux le garder, il faut qu'il existe vraiment côté devices.
  if (topic === "CESI/action/entre") {
    const badgeUid = data?.uid;
    const result = !!data?.resultat;

    if (!badgeUid) {
      console.log(" MQTT action/entre sans uid");
      return;
    }

    // Audit en SQL
    // on tente de retrouver badge_id/user_id si le badge existe
    const badgeRes = await pool.query(
      "SELECT id, owner_user_id AS user_id FROM badges WHERE uid=$1 LIMIT 1",
      [badgeUid]
    );
    const badge = badgeRes.rows[0] || null;

    await pool.query(
      `INSERT INTO access_events (badge_uid, result, badge_id, user_id, topic, device, ts)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [badgeUid, result, badge?.id ?? null, badge?.user_id ?? null, topic, "UNKNOWN", Date.now()]
    );

    // Commande porte
    const portePayload = JSON.stringify({ ouverture: result });
    if (!client?.connected) {
      console.log("⚠️ MQTT pas connecté -> commande porte ignorée");
      return;
    }

    client.publish("CESI/action/porte", portePayload, { qos: 1, retain: false });
    console.log("MQTT envoyé → CESI/action/porte", portePayload);
    return;
  }

  if (topic === "CESI/Request/Enroll") {
    const uid = data?.uid;
    if (!uid) {
      console.log(" CESI/Request/Enroll sans uid");
      return;
    }

    app.locals.latestEnrollRequest = {
      uid,
      receivedAt: new Date().toISOString(),
      payload: typeof data === "object" ? data : { raw: String(data) }
    };

    console.log("UID d'enrôlement reçu:", uid);
    return;
  }
  // ========= INTERPHONE REQUEST =========
if (topic === "CESI/Request/Interphone") {
  const device = data?.device || "UNKNOWN";

  // crée une "demande en attente"
  await pool.query(
    `INSERT INTO interphone_requests (device, payload, status)
     VALUES ($1, $2, 'PENDING')`,
    [device, typeof data === "object" ? data : { raw: String(data) }]
  );

  console.log("🔔 Interphone request enregistrée:", device);
  return;
}

  if (topic === "CESI/Request/Access") {
    const uid = data?.uid;
    const device = data?.device || "UNKNOWN";
    const ts = data?.ts;

    if (!uid) {
      console.log(" CESI/Request/Access sans uid:", data);
      return;
    }

        const badgeRes = await pool.query(
   `SELECT id, owner_user_id AS user_id, is_active, badge_type, expires_at    FROM badges
    WHERE uid=$1
    LIMIT 1`,
    [uid]
    );
    const badge = badgeRes.rows[0] || null;

    let autorise = false;
    if (badge && badge.is_active) {
    if (badge.badge_type === "permanent") autorise = true;
    else autorise = badge.expires_at && new Date(badge.expires_at) > new Date();
    }


    await pool.query(
      `INSERT INTO access_events (badge_uid, result, badge_id, user_id, topic, device, ts)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uid, autorise, badge?.id ?? null, badge?.user_id ?? null, topic, device, ts ?? Date.now()]
    );

    console.log(` Badge ${uid} depuis ${device} -> autorise=${autorise}`);

    const responsePayload = JSON.stringify({ uid, autorise });


    if (!client?.connected) {
      console.log(" MQTT pas connecté -> réponse badge ignorée");
      return;
    }

    client.publish("CESI/Response/Access", responsePayload, { qos: 2, retain: false });
    console.log(" MQTT réponse → CESI/Response/Access", responsePayload);

    if (!autorise) {
      await createAlert({
        mailer: app.locals.mailer,
        type: "DENIED_BADGE",
        severity: "MEDIUM",
        message: `Badge inconnu refusé uid=${uid} device=${device}`
      });
      console.log(" Alerte DENIED_BADGE enregistrée");
    }

    return;
  }

  // ========= INTRUSION =========
  if (topic === "CESI/Alerte/Intrusion" && data?.intrusion === true) {
    console.log("INTRUSION DETECTEE");

    const cooldownMs = Number(process.env.ALERT_COOLDOWN_MS || 60000);
    const since = new Date(Date.now() - cooldownMs);

    const existing = await pool.query(
      `SELECT id FROM alerts
       WHERE type='INTRUSION' AND status='OPEN' AND created_at >= $1
       LIMIT 1`,
      [since]
    );

    if (existing.rows.length > 0) {
      console.log(" Alerte intrusion déjà ouverte -> skip");
      return;
    }

    await createAlert({
    mailer: app.locals.mailer,
    type: "INTRUSION",
    severity: "HIGH",
    zoneId: data?.zoneId || null,
    message: "Intrusion détectée par capteur (sans badge)"
    });


    console.log(" Alerte intrusion enregistrée en base");
    return;
  }

}

module.exports = { startMqtt };
