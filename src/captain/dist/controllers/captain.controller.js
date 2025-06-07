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
exports.getRideHistory = exports.getAllRideRequests = exports.getCaptainDetails = exports.getAvailableCaptains = exports.toggleAvailability = exports.isAvailable = exports.updateProfile = exports.profile = exports.logout = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const captain_model_1 = __importDefault(require("../models/captain.model"));
const blacklisttoken_model_1 = __importDefault(require("../models/blacklisttoken.model"));
const rabbit_1 = __importDefault(require("../service/rabbit"));
const axios_1 = __importDefault(require("axios"));
const notification_1 = require("../service/notification");
const { subscribeToQueue } = rabbit_1.default;
const BASE_URL = process.env.BASE_URL || "http://localhost:8000";
const EVENT_TYPES = {
    RIDE_CREATED: "ride-created",
    RIDE_CANCELLED: "ride-cancelled",
};
const RIDE_STATUS = {
    ALL: "all",
};
function extractToken(req) {
    var _a, _b;
    return ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token) || ((_b = req.headers.authorization) === null || _b === void 0 ? void 0 : _b.split(" ")[1]);
}
// Basic input validation placeholder (extend as needed)
function validateRegisterInput(body) {
    const { name, email, phone, vehicle, password } = body;
    if (!name || !email || !phone || !vehicle || !password) {
        return false;
    }
    // TODO: Add regex/email/phone/password strength validation
    return true;
}
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!validateRegisterInput(req.body)) {
            res.status(400).json({ message: "Missing or invalid fields" });
            return;
        }
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
        const _a = newCaptain.toObject(), { password: _ } = _a, captainWithoutPassword = __rest(_a, ["password"]);
        res.status(201).json({ token, captain: captainWithoutPassword });
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Registration failed" });
    }
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ message: "Email and password required" });
            return;
        }
        const captain = yield captain_model_1.default.findOne({ email }).select("+password");
        if (!captain || !(yield bcrypt_1.default.compare(password, captain.password))) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: captain._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });
        const _a = captain.toObject(), { password: _ } = _a, captainWithoutPassword = __rest(_a, ["password"]);
        res.json({ token, captain: captainWithoutPassword });
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Login failed" });
    }
});
exports.login = login;
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const token = extractToken(req);
        if (!token) {
            res.status(400).json({ message: "No token found" });
            return;
        }
        if ((_a = req.captain) === null || _a === void 0 ? void 0 : _a._id) {
            yield captain_model_1.default.findByIdAndUpdate(req.captain._id, {
                isAvailable: false,
            });
        }
        yield Promise.all([
            blacklisttoken_model_1.default.create({ token }),
            res.clearCookie("token"),
        ]);
        res.json({ message: "Captain logged out successfully and set offline" });
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Logout failed" });
    }
});
exports.logout = logout;
const profile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.captain) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        res.json(req.captain);
    }
    catch (error) {
        res.status(500).json({ message: "Error while fetching profile" });
    }
});
exports.profile = profile;
const updateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.captain) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
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
        const _a = captain.toObject(), { password: _ } = _a, captainWithoutPassword = __rest(_a, ["password"]);
        res.json({
            message: "Profile updated successfully",
            captain: captainWithoutPassword,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Profile update failed" });
    }
});
exports.updateProfile = updateProfile;
const isAvailable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const captainId = (_a = req.captain) === null || _a === void 0 ? void 0 : _a._id;
        if (!captainId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const captain = yield captain_model_1.default
            .findById(captainId)
            .select("isAvailable");
        if (!captain) {
            res.status(404).json({ error: "Captain not found" });
            return;
        }
        console.log(captain.isAvailable);
        res.json(captain.isAvailable);
        return;
    }
    catch (error) {
        console.error("Error checking captain availability:", error);
        res.status(500).json({ error: "Server error" });
        return;
    }
});
exports.isAvailable = isAvailable;
const toggleAvailability = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.captain) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const updatedCaptain = yield captain_model_1.default.findByIdAndUpdate(req.captain._id, [{ $set: { isAvailable: { $not: "$isAvailable" } } }], // atomic toggle with aggregation pipeline update
        { new: true });
        if (!updatedCaptain) {
            res.status(404).json({ message: "Captain not found" });
            return;
        }
        res.json({ isAvailable: updatedCaptain.isAvailable });
    }
    catch (error) {
        res
            .status(500)
            .json({ message: error.message || "Failed to toggle availability" });
    }
});
exports.toggleAvailability = toggleAvailability;
const getAvailableCaptains = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const captains = yield captain_model_1.default
            .find({ isAvailable: true })
            .select("-password");
        res.json(captains);
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Internal server error" });
    }
});
exports.getAvailableCaptains = getAvailableCaptains;
const getCaptainDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const captainId = ((_a = req.params) === null || _a === void 0 ? void 0 : _a.captainId) || req.query.captainId;
        if (!captainId) {
            res.status(400).json({ message: "Captain ID required" });
            return;
        }
        const captain = yield captain_model_1.default
            .findById(captainId)
            .select("name phone vehicle");
        if (!captain) {
            res.status(404).json({ message: "Captain not found" });
            return;
        }
        res.json(captain);
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
        const response = yield axios_1.default.get(`${BASE_URL}/api/ride/rides`);
        const rides = response.data.rides || [];
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
        if (!((_a = req.captain) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({ message: "Unauthorized: Captain not found" });
            return;
        }
        const response = yield axios_1.default.post(`${BASE_URL}/api/ride/ride-history`, {
            captainId: req.captain._id,
            status: RIDE_STATUS.ALL,
        }, {
            withCredentials: true,
            headers: {
                Authorization: req.headers.authorization || "",
                "Content-Type": "application/json",
            },
        });
        res.json(response.data);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: error.message || "Failed to fetch ride history" });
    }
});
exports.getRideHistory = getRideHistory;
[EVENT_TYPES.RIDE_CREATED, EVENT_TYPES.RIDE_CANCELLED].forEach((event) => {
    subscribeToQueue(event, (msg) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const data = JSON.parse(msg);
            const captainId = data.captainId;
            if (captainId) {
                yield (0, notification_1.notifyUser)(captainId, event, data, "captain");
            }
        }
        catch (err) {
            console.log(`Something wrong happened on server: ${err.message}`);
        }
    }));
});
