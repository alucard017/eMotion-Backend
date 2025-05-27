import { Router } from "express";
import { eitherAuth, userAuth } from "../middleware/auth.middleware";
import { captainAuth } from "../middleware/auth.middleware";
import * as rideController from "../controller/ride.controller";

const router: Router = Router();

router.post("/create-ride", userAuth, rideController.createRide);
router.post("/cancel-ride", userAuth, rideController.cancelRide);
router.post("/accept-ride", captainAuth, rideController.acceptRide);
router.post("/start-ride", captainAuth, rideController.startRide);
router.post("/end-ride", captainAuth, rideController.endRide);
router.get("/rides", rideController.getRides);
router.post("/ride-history", rideController.getRide);
export default router;
