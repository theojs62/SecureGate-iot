const router = require("express").Router();
const { createUser, listUsers, setUserBadge, deleteUser } = require("../controllers/userController");

// Si tu as auth/admin :
// const { requireAuth, requireRole } = require("../middleware/auth");
// router.use(requireAuth, requireRole("admin"));

router.post("/", createUser);
router.get("/", listUsers);
router.patch("/:id/badge", setUserBadge);
router.delete("/:id", deleteUser);

module.exports = router;
