const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { notFound, errorHandler } = require("./middlewares/error");

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const interphoneRoutes = require("./routes/interphone.routes");
const badgesRoutes = require("./routes/badges.routes");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(helmet());
  app.use(express.json());
  app.use(morgan("dev"));

  app.get("/health", (req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/users", require("./routes/users"));
  app.use("/api/admin", adminRoutes);
  app.use("/api/admin/badges", badgesRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/interphone", interphoneRoutes);
  app.use("/api/badges", require("./routes/badges.routes"));
  app.use("/api/dashboard/access-events", require("./routes/accessEvents"));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
