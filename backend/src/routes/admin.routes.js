const router = require("express").Router();
const { requireAuth, requireRole } = require("../middlewares/auth");
const ctrl = require("../controllers/admin.controller");

router.use(requireAuth, requireRole("admin"));

router.get("/users", ctrl.listUsers);
router.post("/users", ctrl.createUser);
router.delete("/users/:id", ctrl.deleteUser);

router.get("/zones", ctrl.listZones);
router.post("/zones", ctrl.createZone);

router.get("/sensors", ctrl.listSensors);
router.post("/sensors", ctrl.createSensor);

module.exports = router;
