const Alert = require("../models/Alert");
const Zone = require("../models/Zone");
const User = require("../models/User");

function parseEmails(str) {
  return (str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function sendAlertEmail(mailer, alertDoc) {
  if (!mailer) {
    console.log("📧 (SMTP non configuré) Email alerte:", alertDoc.type, alertDoc.message);
    return;
  }

  const to = parseEmails(process.env.ALERT_EMAIL_TO);
  if (to.length === 0) {
    console.log("📧 ALERT_EMAIL_TO vide -> email non envoyé");
    return;
  }

  const [zone, user] = await Promise.all([
    alertDoc.zoneId ? Zone.findById(alertDoc.zoneId).lean() : null,
    alertDoc.relatedUserId ? User.findById(alertDoc.relatedUserId).lean() : null,
  ]);

  const subject = `[CESI] Alerte ${alertDoc.severity} - ${alertDoc.type}`;

  const text =
`Alerte: ${alertDoc.type}
Gravité: ${alertDoc.severity}
Zone: ${zone?.name || "N/A"}
Utilisateur: ${user ? `${user.firstName} ${user.lastName} (${user.email})` : "N/A"}
Badge UID: ${alertDoc.relatedBadgeUid || "N/A"}
Message: ${alertDoc.message}
Statut: ${alertDoc.status}
Date: ${new Date(alertDoc.createdAt).toLocaleString("fr-FR")}`;

  await mailer.sendMail({
    from: process.env.ALERT_EMAIL_FROM,
    to,
    subject,
    text,
  });

  console.log("📧 Email alerte envoyé à:", to.join(", "));
}

async function createAlert({
  mailer,
  type,
  severity,
  zoneId = null,
  relatedUserId = null,
  relatedBadgeUid = null,
  message,
}) {
  const alert = await Alert.create({
    type,
    severity,
    zoneId,
    relatedUserId,
    relatedBadgeUid,
    message,
    status: "OPEN",
  });

  // email best effort
  try {
    await sendAlertEmail(mailer, alert);
  } catch (e) {
    console.error("📧 Erreur email:", e.message);
  }

  return alert;
}

module.exports = { createAlert };
