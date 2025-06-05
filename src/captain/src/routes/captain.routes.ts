import express from "express";
import * as captainController from "../controllers/captain.controller";
import { captainAuth } from "../middleware/authMiddleWare";

const router = express.Router();

router.post("/register", captainController.register);
router.post("/login", captainController.login);
router.post("/logout", captainAuth, captainController.logout);
router.get("/details/:captainId", captainController.getCaptainDetails);
router.post("/profile", captainAuth, captainController.updateProfile);
router.get("/profile", captainAuth, captainController.profile);
router.post(
  "/toggle-availability",
  captainAuth,
  captainController.toggleAvailability
);
router.get("/get-captains", captainController.getAvailableCaptains);
router.get("/ride-requests", captainAuth, captainController.getAllRideRequests);
router.get("/ride-history", captainAuth, captainController.getRideHistory);

export default router;
