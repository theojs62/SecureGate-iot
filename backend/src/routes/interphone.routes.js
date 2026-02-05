const router = require("express").Router();
const { requireAuth, requireRole } = require("../middlewares/auth");
const { getPendingInterphone, respondInterphone } = require("../controllers/interphone.controller");

router.use(requireAuth, requireRole("admin", "security"));

router.get("/pending", getPendingInterphone);
router.post("/respond", respondInterphone);

module.exports = router;
