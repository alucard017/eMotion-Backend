import express from "express";
import * as userController from "../controllers/user.controller";
import { userAuth } from "../middleware/authMiddleWare";

const router = express.Router();

router.post("/register", userController.register);
router.post("/login", userController.login);
router.post("/logout", userAuth, userController.logout);
router.get("/details/:userId", userController.getUserDetails);
router.get("/profile", userAuth, userController.profile);
router.post("/profile", userAuth, userController.updateProfile);
router.get("/get-captains", userAuth, userController.getAvailableCaptains);
router.get("/ride-history", userAuth, userController.getRideHistory);

export default router;
