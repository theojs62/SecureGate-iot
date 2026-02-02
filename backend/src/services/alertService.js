const { pool } = require("../config/db");

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

  const [zoneRes, userRes] = await Promise.all([
    alertDoc.zoneId
      ? pool.query("SELECT name FROM zones WHERE id = $1 LIMIT 1", [alertDoc.zoneId])
      : Promise.resolve({ rows: [] }),
    alertDoc.relatedUserId
      ? pool.query(
          `SELECT first_name AS "firstName", last_name AS "lastName", email
           FROM users
           WHERE id = $1
           LIMIT 1`,
          [alertDoc.relatedUserId]
        )
      : Promise.resolve({ rows: [] }),
  ]);

  const zone = zoneRes.rows[0] || null;
  const user = userRes.rows[0] || null;

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
  const { rows } = await pool.query(
    `INSERT INTO alerts (type, severity, zone_id, related_user_id, related_badge_uid, message, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'OPEN',NOW(),NOW())
     RETURNING id AS _id, type, severity, zone_id AS "zoneId",
               related_user_id AS "relatedUserId", related_badge_uid AS "relatedBadgeUid",
               status, message, ack_by AS "ackBy", ack_at AS "ackAt",
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [type, severity, zoneId, relatedUserId, relatedBadgeUid, message]
  );
  const alert = rows[0];

  // email best effort
  try {
    await sendAlertEmail(mailer, alert);
  } catch (e) {
    console.error("📧 Erreur email:", e.message);
  }

  return alert;
}

module.exports = { createAlert };
