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
exports.getAllRideRequests = exports.waitForNewRide = exports.toggleAvailability = exports.updateProfile = exports.profile = exports.logout = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const captain_model_1 = __importDefault(require("../models/captain.model"));
const blacklisttoken_model_1 = __importDefault(require("../models/blacklisttoken.model"));
const rabbit_1 = __importDefault(require("../service/rabbit"));
const axios_1 = __importDefault(require("axios"));
const { subscribeToQueue } = rabbit_1.default;
const BASE_URL = process.env.BASE_URL || "http://localhost:4000";
const pendingRequests = new Map();
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
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
    var _a;
    try {
        const token = req.cookies.token || ((_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1]);
        yield blacklisttoken_model_1.default.create({ token });
        res.clearCookie("token");
        res.send({ message: "Captain logged out successfully" });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.logout = logout;
const profile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.send(req.captain);
    }
    catch (error) {
        res.status(500).json({ message: "Error while fetching profile" });
    }
});
exports.profile = profile;
const updateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
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
        const captain = yield captain_model_1.default.findById(req.captain._id);
        if (!captain) {
            res.status(404).json({ message: "Captain not found" });
            return;
        }
        captain.isAvailable = !captain.isAvailable;
        yield captain.save();
        res.send(captain);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.toggleAvailability = toggleAvailability;
const waitForNewRide = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const captainId = String((_a = req.captain) === null || _a === void 0 ? void 0 : _a._id);
    // Clear previous pending request if exists (optional)
    const previous = pendingRequests.get(captainId);
    if (previous && !previous.writableEnded) {
        previous.status(204).end();
    }
    pendingRequests.set(captainId, res);
    const timeout = setTimeout(() => {
        // Only delete if current response is still the same
        if (pendingRequests.get(captainId) === res) {
            pendingRequests.delete(captainId);
            res.status(204).end();
        }
    }, 30000);
    res.on("close", () => {
        clearTimeout(timeout);
        // Only delete if current response is still the same
        if (pendingRequests.get(captainId) === res) {
            pendingRequests.delete(captainId);
        }
    });
});
exports.waitForNewRide = waitForNewRide;
const getAllRideRequests = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const token = ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token) || ((_c = (_b = req.headers) === null || _b === void 0 ? void 0 : _b.authorization) === null || _c === void 0 ? void 0 : _c.split(" ")[1]);
        const response = yield axios_1.default.get(`${BASE_URL}/api/rides`, {
            params: { status: "requested" },
            withCredentials: true,
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        // Assuming ride service responds with { rides: [...] }
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
subscribeToQueue("new-ride", (data) => {
    const rideData = JSON.parse(data);
    const captainId = rideData.captainId;
    const res = pendingRequests.get(captainId);
    if (res) {
        res.json(rideData);
        pendingRequests.delete(captainId);
    }
});
