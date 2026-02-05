/* eslint-disable no-console */
require("dotenv").config();
const mqtt = require("mqtt");

// OPTIONAL DB CHECK
let pool = null;
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require("pg");
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  } catch {
    // ignore
  }
}

// ====== CONFIG ======
const URL = process.env.MQTT_URL || "mqtt://10.121.195.246:1883";
const OPTS = {
  username: process.env.MQTT_USERNAME || "Sys_Admin",
  password: process.env.MQTT_PASSWORD || "zHq1tZS!G4$qRlfQ00!c",
  clientId: "test-all-" + Math.random().toString(16).slice(2),
  connectTimeout: 5000,
  reconnectPeriod: 0, // on veut voir l'erreur
};

const TOPICS_SUB = [
  "CESI/Response/Badge",
  "CESI/action/porte",
  "CESI/Response/Interphone",
  "CESI/#" // option: tout voir (bruyant)
];

// UID à adapter selon ta DB badges.uid
const UID_KNOWN = process.env.TEST_UID_KNOWN || "35 0D FB 54";
const UID_UNKNOWN = process.env.TEST_UID_UNKNOWN || "00 00 00 00";

console.log("➡️ Connexion MQTT à", URL);

const client = mqtt.connect(URL, OPTS);

const failTimer = setTimeout(() => {
  console.error("⏱️ Timeout: impossible de se connecter au broker (réseau/identifiants/host?)");
  process.exit(1);
}, 7000);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function dbCount(sql, params) {
  if (!pool) return null;
  const r = await pool.query(sql, params);
  return Number(r.rows[0]?.c ?? 0);
}

async function runTests() {
  console.log("\n🧪 Tests MQTT démarrés...\n");

  // ========== (A) Badge Request/Response ==========
  console.log("A) 📤 Publish CESI/Request/Badge (UID connu) => attendre CESI/Response/Badge autorise=true");
  client.publish(
    "CESI/Request/Badge",
    JSON.stringify({ uid: UID_KNOWN, device: "TEST_PC", ts: Date.now() }),
    { qos: 1, retain: false }
  );
  await sleep(800);

  console.log("B) 📤 Publish CESI/Request/Badge (UID inconnu) => attendre autorise=false + alert DENIED_BADGE");
  client.publish(
    "CESI/Request/Badge",
    JSON.stringify({ uid: UID_UNKNOWN, device: "TEST_PC", ts: Date.now() }),
    { qos: 1, retain: false }
  );
  await sleep(800);

  // ========== (B) Intrusion ==========
  console.log("C) 📤 Publish CESI/Alerte/Intrusion => backend doit créer alert INTRUSION (anti-spam possible)");
  client.publish(
    "CESI/Alerte/Intrusion",
    JSON.stringify({ intrusion: true }),
    { qos: 1, retain: false }
  );
  await sleep(800);

  // ========== (C) Ancien topic action/entre ==========
  console.log("D) 📤 Publish CESI/action/entre => backend doit publier CESI/action/porte (ouverture:true/false)");
  client.publish(
    "CESI/action/entre",
    JSON.stringify({ resultat: true, uid: UID_KNOWN }),
    { qos: 1, retain: false }
  );
  await sleep(500);

  client.publish(
    "CESI/action/entre",
    JSON.stringify({ resultat: false, uid: UID_UNKNOWN }),
    { qos: 1, retain: false }
  );
  await sleep(800);

  // ========== (D) Interphone (option) ==========
  console.log("E) (option) 📤 Publish CESI/Response/Interphone => juste pour vérifier qu'on publie bien");
  client.publish(
    "CESI/Response/Interphone",
    JSON.stringify({ autorise: true }),
    { qos: 1, retain: false }
  );
  await sleep(500);

  // ========== (E) DB Checks (option) ==========
  if (pool) {
    console.log("\n🗄️ Checks DB (optionnels) ...");

    const ae = await dbCount("SELECT COUNT(*)::text AS c FROM access_events WHERE device='TEST_PC'");
    console.log(" - access_events (device=TEST_PC) =", ae);

    const denied = await dbCount(
      "SELECT COUNT(*)::text AS c FROM alerts WHERE type='DENIED_BADGE' AND message ILIKE '%TEST_PC%'"
    );
    console.log(" - alerts DENIED_BADGE (TEST_PC) =", denied);

    const intr = await dbCount("SELECT COUNT(*)::text AS c FROM alerts WHERE type='INTRUSION'");
    console.log(" - alerts INTRUSION =", intr);
  } else {
    console.log("\nℹ️ DB check ignoré (DATABASE_URL non défini ou pg non installé)");
  }

  console.log("\n✅ Tests terminés.");
}

client.on("connect", async () => {
  clearTimeout(failTimer);
  console.log("✅ CONNECTÉ");

  // subscribe
  let pending = TOPICS_SUB.length;
  for (const t of TOPICS_SUB) {
    client.subscribe(t, { qos: 0 }, (err) => {
      if (err) console.error("❌ subscribe error:", t, err.message);
      else console.log("📡 Abonné à:", t);
      pending--;
      if (pending === 0) {
        // run tests
        runTests()
          .then(async () => {
            await sleep(800);
            console.log("👋 fermeture");
            client.end(true, async () => {
              try { if (pool) await pool.end(); } catch {}
              process.exit(0);
            });
          })
          .catch((e) => {
            console.error("❌ Test error:", e);
            process.exit(1);
          });
      }
    });
  }
});

client.on("message", (topic, buf) => {
  const raw = buf.toString("utf-8");
  let data = raw;
  try { data = JSON.parse(raw); } catch {}

  // Filtrage léger pour lisibilité
  if (
    topic.startsWith("CESI/Response/") ||
    topic === "CESI/action/porte" ||
    topic === "CESI/action/entre"
  ) {
    console.log("📥", topic, data);
  }
});

client.on("error", (err) => {
  clearTimeout(failTimer);
  console.error("❌ MQTT ERROR:", err.message);
  process.exit(1);
});

client.on("close", () => console.log("🔌 connexion fermée"));
client.on("offline", () => console.log("📴 offline"));
