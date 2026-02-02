const router = require("express").Router();
const {
  createBadge,
  listBadges,
  deleteBadge,
  assignBadge,
} = require("../controllers/badgeController");

// si tu as un middleware auth/admin, mets-le ici
// const { requireAuth, requireRole } = require("../middleware/auth");
// router.use(requireAuth, requireRole("admin"));

router.post("/", createBadge);
router.get("/", listBadges);
router.delete("/:id", deleteBadge);
router.patch("/:id/assign", assignBadge);

module.exports = router;
