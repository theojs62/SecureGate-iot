const router = require("express").Router();
const { requireAuth, requireRole } = require("../middlewares/auth");
const { listBadges, createBadge, assignBadge, deleteBadge, getEnrollRequest, consumeEnrollRequest } = require("../controllers/badges.controller");

router.use(requireAuth, requireRole("admin"));

router.get("/", listBadges);
router.get("/enroll-request", getEnrollRequest);
router.post("/enroll-request/consume", consumeEnrollRequest);
router.post("/", createBadge);
router.post("/:id/assign", assignBadge);
router.delete("/:id", deleteBadge);

module.exports = router;