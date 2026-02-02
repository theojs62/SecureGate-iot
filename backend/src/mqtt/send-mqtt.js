const mqtt = require("mqtt");

const URL = "mqtt://10.118.150.246:1883";
const OPTS = {
  username: "Sys_Admin",
  password: "zHq1tZS!G4$qRlfQ00!c",
  clientId: "test-pub-" + Math.random().toString(16).slice(2),
  connectTimeout: 5000,
  reconnectPeriod: 0, // pas de retry, on veut voir l'erreur
};

console.log("➡️ Connexion à", URL);

const client = mqtt.connect(URL, OPTS);

const failTimer = setTimeout(() => {
  console.error("⏱️ Timeout: impossible de se connecter au broker (réseau/identifiants/host?)");
  process.exit(1);
}, 7000);

client.on("connect", () => {
  clearTimeout(failTimer);
  console.log("✅ CONNECTÉ");

  const msg1 = { resultat: true, uid: "35 0D FB 54" };
  const msg2 = { resultat: false, uid: "4B 50 55 3E" };

  client.publish("CESI/action/entre", JSON.stringify(msg1), { qos: 0 }, (err) => {
    if (err) console.error("❌ publish 1 error:", err.message);
    else console.log("📤 envoyé 1:", msg1);
  });

  client.publish("CESI/action/entre", JSON.stringify(msg2), { qos: 0 }, (err) => {
    if (err) console.error("❌ publish 2 error:", err.message);
    else console.log("📤 envoyé 2:", msg2);
  });

  setTimeout(() => {
    console.log("👋 fermeture");
    client.end(true, () => process.exit(0));
  }, 500);
});

client.on("error", (err) => {
  clearTimeout(failTimer);
  console.error("❌ MQTT ERROR:", err.message);
  process.exit(1);
});

client.on("close", () => {
  console.log("🔌 connexion fermée");
});

client.on("offline", () => {
  console.log("📴 offline");
});
