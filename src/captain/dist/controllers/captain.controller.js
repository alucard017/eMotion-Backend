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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRideHistory = exports.getAllRideRequests = exports.getCaptainDetails = exports.getAvailableCaptains = exports.toggleAvailability = exports.updateProfile = exports.profile = exports.logout = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const captain_model_1 = __importDefault(require("../models/captain.model"));
const blacklisttoken_model_1 = __importDefault(require("../models/blacklisttoken.model"));
const rabbit_1 = __importDefault(require("../service/rabbit"));
const axios_1 = __importDefault(require("axios"));
const { subscribeToQueue } = rabbit_1.default;
const BASE_URL = process.env.BASE_URL || "http://localhost:8000";
const WEBSOCKET_SERVER_URL = "http://localhost:8080";
const pendingRequests = new Map();
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Captain Register Invoked`);
        const { name, email, phone, vehicle, password } = req.body;
        const existingCaptain = yield captain_model_1.default.findOne({ email });
        if (existingCaptain) {
            res.status(400).json({ message: "Captain already exists" });
            return;
        }
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        const newCaptain = new captain_model_1.default({
            name,
            email,
            phone,
            vehicle,
            password: hashedPassword,
        });
        yield newCaptain.save();
        const token = jsonwebtoken_1.default.sign({ id: newCaptain._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });
        const cleanCaptain = newCaptain.toObject();
        const { password: _ } = cleanCaptain, captainWithoutPassword = __rest(cleanCaptain, ["password"]);
        res.send({ token, captain: captainWithoutPassword });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Captain Login Invoked`);
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(404).json({ message: "Both fields are required" });
            return;
        }
        const captain = yield captain_model_1.default.findOne({ email }).select("+password");
        if (!captain || !(yield bcrypt_1.default.compare(password, captain.password))) {
            res.status(400).json({ message: "Invalid email or password" });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: captain._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });
        const cleanCaptain = captain.toObject();
        const { password: _ } = cleanCaptain, captainWithoutPassword = __rest(cleanCaptain, ["password"]);
        res.send({ token, captain: captainWithoutPassword });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.login = login;
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        console.log(`Captain Logout Invoked`);
        const token = req.cookies.token || ((_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1]);
        // console.log(req.captain);
        const captainId = (_b = req.captain) === null || _b === void 0 ? void 0 : _b._id;
        if (captainId) {
            yield captain_model_1.default.findByIdAndUpdate(captainId, { isAvailable: false });
            // console.log(`LOGOUT isavailable set false`);
        }
        yield blacklisttoken_model_1.default.create({ token });
        res.clearCookie("token");
        res.send({ message: "Captain logged out successfully and set offline" });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.logout = logout;
const profile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Captain Profile GET Invoked`);
        res.send(req.captain);
    }
    catch (error) {
        res.status(500).json({ message: "Error while fetching profile" });
    }
});
exports.profile = profile;
const updateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Captain Profile POST Invoked`);
        const { name, email, phone, vehicle } = req.body;
        const captain = yield captain_model_1.default.findById(req.captain._id);
        if (!captain) {
            res.status(404).json({ message: "Captain not found" });
            return;
        }
        if (name)
            captain.name = name;
        if (email)
            captain.email = email;
        if (phone)
            captain.phone = phone;
        if (vehicle)
            captain.vehicle = vehicle;
        yield captain.save();
        const cleanCaptain = captain.toObject();
        const { password: _ } = cleanCaptain, captainWithoutPassword = __rest(cleanCaptain, ["password"]);
        res.json({
            message: "Profile updated successfully",
            captain: captainWithoutPassword,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.updateProfile = updateProfile;
const toggleAvailability = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Captain Toggle Availability Invoked`);
        const captain = yield captain_model_1.default.findById(req.captain._id);
        if (!captain) {
            res.status(404).json({ message: "Captain not found" });
            return;
        }
        captain.isAvailable = !captain.isAvailable;
        yield captain.save();
        res.json({ isAvailable: captain.isAvailable });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.toggleAvailability = toggleAvailability;
const getAvailableCaptains = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`Captain getAvailableCaptains invoked`);
    try {
        const captains = yield captain_model_1.default.find({ isAvailable: true }).select("-password" // exclude password
        );
        res.status(200).json(captains);
    }
    catch (error) {
        console.error("Error fetching available captains:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.getAvailableCaptains = getAvailableCaptains;
const forwardToWebSocket = (captainId, event, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield axios_1.default.post(`${WEBSOCKET_SERVER_URL}/notify`, {
            userId: captainId,
            event,
            data,
        });
    }
    catch (err) {
        console.error("Failed to send WebSocket message:", err.message);
    }
});
// RabbitMQ subscriptions
subscribeToQueue("ride-created", (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const data = JSON.parse(msg);
    const { captainId } = data;
    if (captainId) {
        yield forwardToWebSocket(captainId, "ride-created", data);
    }
}));
subscribeToQueue("ride-cancelled", (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const data = JSON.parse(msg);
    const { captainId } = data;
    if (captainId) {
        yield forwardToWebSocket(captainId, "ride-cancelled", data);
    }
}));
const getCaptainDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const captainId = req.params.id || req.query.id;
        if (!captainId) {
            res.status(404).send("Captain ID required");
            return;
        }
        const captain = yield captain_model_1.default.findById(captainId);
        res.send(captain);
    }
    catch (err) {
        res
            .status(500)
            .json({ message: err.message || "Failed to fetch captain details" });
    }
});
exports.getCaptainDetails = getCaptainDetails;
const getAllRideRequests = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Captain GetAllRideRequests invoked`);
        const response = yield axios_1.default.get(`${BASE_URL}/api/ride/rides`);
        const rides = response.data.rides;
        res.json({ rides });
    }
    catch (error) {
        res
            .status(500)
            .json({ message: error.message || "Failed to fetch ride requests" });
    }
});
exports.getAllRideRequests = getAllRideRequests;
const getRideHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        console.log(`Captain Ride History Called`);
        const captainId = (_a = req.captain) === null || _a === void 0 ? void 0 : _a._id;
        if (!captainId) {
            res.status(401).json({ message: "Unauthorized: Captain not found" });
            return;
        }
        const response = yield axios_1.default.post(`${BASE_URL}/api/ride/ride-history`, {
            captainId,
            status: "all", // <-- request body
        }, {
            withCredentials: true,
            headers: {
                Authorization: req.headers.authorization || "",
                "Content-Type": "application/json",
            },
        });
        console.log(response);
        res.json(response.data);
    }
    catch (error) {
        console.error("Error fetching captain ride history:", error);
        res
            .status(500)
            .json({ message: error.message || "Failed to fetch ride history" });
    }
});
exports.getRideHistory = getRideHistory;
