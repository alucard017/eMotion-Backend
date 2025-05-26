"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRides = exports.cancelRide = exports.acceptRide = exports.createRide = void 0;
const ride_model_1 = __importDefault(require("../models/ride.model"));
const rabbit_1 = __importDefault(require("../service/rabbit"));
const mongoose_1 = require("mongoose");
const { publishToQueue } = rabbit_1.default;
const createRide = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        console.log(`Ride createRide invoked`);
        const { pickup, destination } = req.body;
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({ message: "Unauthorized: User not found" });
            return;
        }
        const newRide = new ride_model_1.default({
            user: req.user._id,
            pickup,
            destination,
            status: "requested",
        });
        yield newRide.save();
        // Publish new ride event with ride id and other info
        publishToQueue("new-ride", JSON.stringify(newRide));
        res.status(201).send(newRide);
    }
    catch (error) {
        next(error);
    }
});
exports.createRide = createRide;
const acceptRide = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        console.log(`Ride acceptRide invoked.`);
        const rideId = req.body.rideId;
        if (!rideId) {
            res.status(400).json({ message: "Ride ID is required" });
            return;
        }
        if (!((_a = req.captain) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({ message: "Unauthorized: Captain not found" });
            return;
        }
        const ride = yield ride_model_1.default.findOneAndUpdate({ _id: rideId, status: "requested" }, { status: "accepted", captain: new mongoose_1.Types.ObjectId(req.captain._id) }, { new: true });
        if (!ride) {
            res.status(409).json({ message: "Ride already accepted or unavailable" });
            return;
        }
        publishToQueue("ride-accepted", JSON.stringify(ride));
        res.send(ride);
    }
    catch (error) {
        next(error);
    }
});
exports.acceptRide = acceptRide;
const cancelRide = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        console.log(`Ride cancelRide invoked`);
        const { rideId } = req.body;
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({ message: "Unauthorized: User not found" });
            return;
        }
        const ride = yield ride_model_1.default.findById(rideId);
        if (!ride) {
            res.status(404).json({ message: "Ride not found" });
            return;
        }
        if (ride.user.toString() !== req.user._id.toString()) {
            res
                .status(403)
                .json({ message: "You are not allowed to cancel this ride" });
            return;
        }
        yield ride_model_1.default.findByIdAndDelete(rideId);
        res.status(200).json({ message: "Ride cancelled successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message || "Server error" });
    }
});
exports.cancelRide = cancelRide;
const getRides = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        console.log(`Ride getRides invoked`);
        if (!((_a = req.captain) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({ message: "Unauthorized: Captain not found" });
            return;
        }
        const { status } = req.query;
        const captainId = req.captain._id.toString();
        const query = { captain: captainId };
        if (status)
            query.status = status;
        // Fetch rides from Ride DB
        const rides = yield ride_model_1.default
            .find(query)
            .populate("user", "name email")
            .populate("captain", "name email");
        res.json({ rides });
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Failed to fetch rides" });
    }
});
exports.getRides = getRides;
