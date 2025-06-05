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
exports.getRide = exports.getRides = exports.getCaptainById = exports.getUserById = exports.endRide = exports.startRide = exports.cancelRide = exports.acceptRide = exports.createRide = void 0;
const ride_model_1 = __importDefault(require("../models/ride.model"));
const rabbit_1 = __importDefault(require("../service/rabbit"));
const mongoose_1 = require("mongoose");
const axios_1 = __importDefault(require("axios"));
const notification_1 = require("../service/notification");
const { publishToQueue } = rabbit_1.default;
const BASE_URL = process.env.BASE_URL || "http://localhost:4000";
const createRide = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        console.log(`createRide invoked`);
        const { pickup, destination, fare } = req.body;
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({ message: "Unauthorized: User not found" });
            return;
        }
        const newRide = new ride_model_1.default({
            user: req.user._id,
            pickup,
            destination,
            fare,
            status: "requested",
        });
        yield newRide.save();
        publishToQueue("ride-created", JSON.stringify(newRide));
        (0, notification_1.notifyUser)(req.user._id, "ride-created", newRide);
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
        console.log("Captain info from request:", req.captain);
        console.log("Request body: ", req.body);
        const rideId = req.body.rideId;
        console.log(`AcceptRide invoked and ride id is: ${rideId}`);
        if (!rideId) {
            res.status(400).json({ message: "Ride ID is required" });
            return;
        }
        if (!((_a = req.captain) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({ message: "Unauthorized: Captain not found" });
            return;
        }
        const ride = yield ride_model_1.default.findOneAndUpdate({ _id: rideId, status: "requested" }, { status: "accepted", captain: new mongoose_1.Types.ObjectId(req.captain._id) }, { new: true });
        console.log(`Ride is ${ride}`);
        if (!ride) {
            res.status(409).json({ message: "Ride already accepted or unavailable" });
            return;
        }
        publishToQueue("ride-accepted", JSON.stringify(ride));
        (0, notification_1.notifyUser)(ride.user.toString(), "ride-accepted", ride);
        (0, notification_1.notifyUser)(req.captain._id, "ride-accepted", ride);
        res.send(ride);
    }
    catch (error) {
        next(error);
    }
});
exports.acceptRide = acceptRide;
const cancelRide = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const rideId = req.body.rideId;
        if (!rideId) {
            res.status(400).json({ message: "Ride ID is required" });
            return;
        }
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({ message: "Unauthorized: User not found" });
            return;
        }
        const ride = yield ride_model_1.default.findOneAndUpdate({
            _id: rideId,
            status: "requested",
            user: new mongoose_1.Types.ObjectId(req.user._id),
        }, { status: "cancelled" }, { new: true });
        if (!ride) {
            res.status(409).json({ message: "Ride cannot be cancelled" });
            return;
        }
        publishToQueue("ride-cancelled", JSON.stringify(ride));
        (0, notification_1.notifyUser)(req.user._id, "ride-cancelled", ride);
        res.send({ message: "Ride cancelled successfully", ride });
    }
    catch (error) {
        next(error);
    }
});
exports.cancelRide = cancelRide;
const startRide = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        console.log("Start ride invoked");
        const rideId = req.body.rideId;
        console.log("Ride id from start ride:", rideId);
        if (!rideId) {
            res.status(400).json({ message: "Ride ID is required" });
            return;
        }
        if (!((_a = req.captain) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({ message: "Unauthorized: Captain not found" });
            return;
        }
        const ride = yield ride_model_1.default.findOneAndUpdate({
            _id: rideId,
            status: "accepted",
            captain: new mongoose_1.Types.ObjectId(req.captain._id),
        }, { status: "started" }, { new: true });
        if (!ride) {
            res.status(409).json({ message: "Ride cannot be started" });
            return;
        }
        publishToQueue("ride-started", JSON.stringify(ride));
        (0, notification_1.notifyUser)(ride.user.toString(), "ride-started", ride);
        (0, notification_1.notifyUser)(req.captain._id, "ride-started", ride);
        res.send(ride);
    }
    catch (error) {
        next(error);
    }
});
exports.startRide = startRide;
const endRide = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const rideId = req.body.rideId;
        if (!rideId) {
            res.status(400).json({ message: "Ride ID is required" });
            return;
        }
        if (!((_a = req.captain) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({ message: "Unauthorized: Captain not found" });
            return;
        }
        const ride = yield ride_model_1.default.findOneAndUpdate({
            _id: rideId,
            status: "started",
            captain: new mongoose_1.Types.ObjectId(req.captain._id),
        }, { status: "completed", completedAt: new Date() }, { new: true });
        if (!ride) {
            res.status(409).json({ message: "Ride cannot be ended" });
            return;
        }
        publishToQueue("ride-completed", JSON.stringify(ride));
        (0, notification_1.notifyUser)(ride.user.toString(), "ride-completed", ride);
        (0, notification_1.notifyUser)(req.captain._id, "ride-completed", ride);
        res.send(ride);
    }
    catch (error) {
        next(error);
    }
});
exports.endRide = endRide;
const getUserById = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const { data } = yield axios_1.default.get(`${BASE_URL}/api/user/details/${userId}`);
    return { name: data.name, phone: data.phone };
});
exports.getUserById = getUserById;
const getCaptainById = (captainId) => __awaiter(void 0, void 0, void 0, function* () {
    const { data } = yield axios_1.default.get(`${BASE_URL}/api/captain/${captainId}`);
    return { name: data.name, phone: data.phone, vehicle: data.vehicle };
});
exports.getCaptainById = getCaptainById;
const getRides = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rides = yield ride_model_1.default.find({
            status: "requested",
        });
        const enrichedRides = yield Promise.all(rides.map((ride) => __awaiter(void 0, void 0, void 0, function* () {
            const userInfo = yield (0, exports.getUserById)(ride.user.toString());
            return Object.assign(Object.assign({}, ride.toObject()), { user: userInfo, captain: null });
        })));
        res.json({ rides: enrichedRides });
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Failed to fetch rides" });
    }
});
exports.getRides = getRides;
const getRide = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("GetRide invoked");
        let { userId, captainId, status } = req.body;
        console.log(`Userid: ${userId}, CaptainId: ${captainId}, Status: ${status}`);
        if (status &&
            status !== "all" &&
            !["requested", "accepted", "started", "completed", "cancelled"].includes(status)) {
            res.status(400).json({ message: "Invalid status query parameter" });
            return;
        }
        if (!userId && !captainId) {
            res
                .status(401)
                .json({ message: "Unauthorized: User or Captain not found" });
            return;
        }
        let query = {};
        if (status && status !== "all") {
            query.status = status;
        }
        if (userId) {
            query.user = userId;
        }
        else if (captainId) {
            if (status === "cancelled") {
                res.json({ rides: [] });
                return;
            }
            query.captain = captainId;
        }
        const rides = yield ride_model_1.default.find(query);
        console.log("Rides are : ", rides);
        const enrichedRides = yield Promise.all(rides.map((ride) => __awaiter(void 0, void 0, void 0, function* () {
            const userInfo = ride.user
                ? yield (0, exports.getUserById)(ride.user.toString())
                : null;
            const captainInfo = ride.captain
                ? yield (0, exports.getCaptainById)(ride.captain.toString())
                : null;
            return Object.assign(Object.assign({}, ride.toObject()), { user: userInfo, captain: captainInfo });
        })));
        console.log("Enriched Rides are: ", enrichedRides);
        res.json({ rides: enrichedRides });
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Failed to fetch rides" });
    }
});
exports.getRide = getRide;
