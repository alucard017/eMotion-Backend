"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const auth_middleware_2 = require("../middleware/auth.middleware");
const rideController = __importStar(require("../controller/ride.controller"));
const router = (0, express_1.Router)();
router.post("/create-ride", auth_middleware_1.userAuth, rideController.createRide);
router.post("/cancel-ride", auth_middleware_1.userAuth, rideController.cancelRide);
router.post("/accept-ride", auth_middleware_2.captainAuth, rideController.acceptRide);
router.post("/start-ride", auth_middleware_2.captainAuth, rideController.startRide);
router.post("/end-ride", auth_middleware_2.captainAuth, rideController.endRide);
router.get("/rides", rideController.getRides);
router.post("/ride-history", rideController.getRide);
// router.post("/create-ride", rideController.createRide);
// router.post("/cancel-ride", rideController.cancelRide);
// router.post("/accept-ride", rideController.acceptRide);
// router.post("/start-ride", rideController.startRide);
// router.post("/end-ride", rideController.endRide);
// router.get("/rides", rideController.getRides);
// router.post("/ride-history", rideController.getRide);
exports.default = router;
