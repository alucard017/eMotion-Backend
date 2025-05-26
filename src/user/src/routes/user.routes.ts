import express from "express";
import * as userController from "../controllers/user.controller";
import { userAuth } from "../middleware/authMiddleWare";

const router = express.Router();

router.post("/register", userController.register);
router.post("/login", userController.login);
router.post("/logout", userAuth, userController.logout);
router.get("/profile", userAuth, userController.profile);
router.post("/profile", userAuth, userController.updateProfile);
router.get("/accepted-ride", userAuth, userController.acceptedRide);
router.get("/get-captains", userAuth, userController.availableCaptains);
export default router;
