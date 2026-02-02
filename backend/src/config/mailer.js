const nodemailer = require("nodemailer");

function createMailerFromEnv() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  // si pas configuré -> on retourne null (mode "log only")
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.log("📧 SMTP non configuré -> emails désactivés");
    return null;
  }

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE).toLowerCase() === "true", // true pour 465
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  // Vérif au démarrage (best effort)
  transport.verify()
    .then(() => console.log("📧 SMTP OK"))
    .catch((e) => console.error("📧 SMTP KO:", e.message));

  return transport;
}

module.exports = { createMailerFromEnv };
