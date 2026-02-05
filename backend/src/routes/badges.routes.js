const router = require("express").Router();
const { requireAuth, requireRole } = require("../middlewares/auth");
const { listBadges, createBadge, assignBadge, setBadgeActive } = require("../controllers/badges.controller");

router.use(requireAuth, requireRole("admin"));

router.get("/", listBadges);
router.post("/", createBadge);
router.post("/:id/assign", assignBadge);
router.post("/:id/active", setBadgeActive);

module.exports = router;
