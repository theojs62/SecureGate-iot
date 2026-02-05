const router = require("express").Router();
const { requireAuth, requireRole } = require("../middlewares/auth");
const { listBadges, createBadge, assignBadge } = require("../controllers/badges.controller");

router.use(requireAuth, requireRole("admin"));

router.get("/", listBadges);
router.post("/", createBadge);
router.post("/:id/assign", assignBadge);

module.exports = router;