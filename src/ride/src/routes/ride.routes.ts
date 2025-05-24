import { Router } from "express";
import { userAuth } from "../middleware/auth.middleware";
import { captainAuth } from "../middleware/auth.middleware";
import * as rideController from "../controller/ride.controller";

const router: Router = Router();

router.post("/create-ride", userAuth, rideController.createRide);
router.post("/accept-ride", captainAuth, rideController.acceptRide);
router.post("/cancel-ride", userAuth, rideController.cancelRide);
router.get("/rides", captainAuth, rideController.getRides);
export default router;
