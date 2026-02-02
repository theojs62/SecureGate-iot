const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { pool } = require("../config/db");

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const { email, password } = parsed.data;
  const { rows } = await pool.query(
    `SELECT id, email, password_hash AS "passwordHash", first_name AS "firstName",
            last_name AS "lastName", role
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { sub: String(user.id), role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );

  res.json({
    token,
    user: { id: String(user.id), email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }
  });
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { login, me };
