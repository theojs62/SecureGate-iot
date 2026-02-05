require("dotenv").config();

const { createApp } = require("./app");
const { connectDB } = require("./config/db");
const { startMqtt } = require("./mqtt/mqttClient");
const { createMailerFromEnv } = require("./config/mailer");

async function main() {
  const app = createApp();
  app.locals.mailer = createMailerFromEnv();
  
  await connectDB();
  const PORT = Number(process.env.PORT || 8080);

  app.listen(PORT, () => {
    console.log(`🚀 Backend lancé sur http://localhost:${PORT}`);

    startMqtt(app);
    app.locals.mqttClient = startMqtt(app);
  });
}

main().catch((e) => {
  console.error("Erreur fatale au démarrage :", e);
  process.exit(1);
});
