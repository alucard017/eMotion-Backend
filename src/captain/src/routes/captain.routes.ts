import express from "express";
import * as captainController from "../controllers/captain.controller";
import { captainAuth } from "../middleware/authMiddleWare";

const router = express.Router();

router.post("/register", captainController.register);
router.post("/login", captainController.login);
router.post("/logout", captainController.logout);
router.post("/profile", captainAuth, captainController.updateProfile);
router.get("/profile", captainAuth, captainController.profile);
router.post(
  "/toggle-availability",
  captainAuth,
  captainController.toggleAvailability
);
router.get("/new-ride", captainAuth, captainController.waitForNewRide);
router.get("/ride-requests", captainAuth, captainController.getAllRideRequests);
export default router;
