const router = require("express").Router();
const { listAccessEvents } = require("../controllers/accessEventController");

// si tu as un middleware auth, mets-le là
// const { requireAuth } = require("../middleware/auth");
// router.use(requireAuth);

router.get("/", listAccessEvents);

module.exports = router;
