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
exports.getRideHistory = exports.getUserDetails = exports.availableCaptains = exports.updateProfile = exports.profile = exports.logout = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importDefault(require("../models/user.model"));
const blacklisttoken_model_1 = __importDefault(require("../models/blacklisttoken.model"));
const rabbit_1 = __importDefault(require("../service/rabbit"));
const axios_1 = __importDefault(require("axios"));
const notification_1 = require("../service/notification");
const { subscribeToQueue } = rabbit_1.default;
const BASE_URL = process.env.BASE_URL || "http://localhost:8000";
const EVENT_TYPES = {
    RIDE_ACCEPTED: "ride-accepted",
    RIDE_STARTED: "ride-started",
    RIDE_COMPLETED: "ride-completed",
};
function extractToken(req) {
    var _a, _b;
    return ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token) || ((_b = req.headers.authorization) === null || _b === void 0 ? void 0 : _b.split(" ")[1]);
}
function validateRegisterInput(body) {
    const { name, email, phone, password } = body;
    if (!name || !email || !phone || !password)
        return false;
    // TODO: Add regex/email/phone/password strength validation
    return true;
}
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!validateRegisterInput(req.body)) {
            res.status(400).json({ message: "Missing or invalid fields" });
            return;
        }
        const { name, email, phone, password } = req.body;
        const existingUser = yield user_model_1.default.findOne({ email });
        if (existingUser) {
            res.status(400).json({ message: "User already exists" });
            return;
        }
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        const newUser = new user_model_1.default({
            name,
            email,
            phone,
            password: hashedPassword,
        });
        yield newUser.save();
        const token = jsonwebtoken_1.default.sign({ id: newUser._id }, process.env.JWT_SECRET, {
            expiresIn: "1h",
        });
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });
        const _a = newUser.toObject(), { password: _ } = _a, userWithoutPassword = __rest(_a, ["password"]);
        res.status(201).json({ token, user: userWithoutPassword });
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
        const user = yield user_model_1.default.findOne({ email }).select("+password");
        if (!user || !(yield bcrypt_1.default.compare(password, user.password))) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: "1h",
        });
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });
        const _a = user.toObject(), { password: _ } = _a, userWithoutPassword = __rest(_a, ["password"]);
        res.json({ token, user: userWithoutPassword });
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Login failed" });
    }
});
exports.login = login;
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = extractToken(req);
        if (!token) {
            res.status(400).json({ message: "No token found" });
            return;
        }
        yield Promise.all([
            blacklisttoken_model_1.default.create({ token }),
            res.clearCookie("token"),
        ]);
        res.json({ message: "User logged out successfully" });
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Logout failed" });
    }
});
exports.logout = logout;
const profile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        res.json(req.user);
    }
    catch (_a) {
        res.status(500).json({ message: "Error fetching profile" });
    }
});
exports.profile = profile;
const updateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const { name, email, phone } = req.body;
        const user = yield user_model_1.default.findById(req.user._id);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        if (name)
            user.name = name;
        if (email)
            user.email = email;
        if (phone)
            user.phone = phone;
        yield user.save();
        const _a = user.toObject(), { password: _ } = _a, userWithoutPassword = __rest(_a, ["password"]);
        res.json({
            message: "Profile updated successfully",
            user: userWithoutPassword,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Profile update failed" });
    }
});
exports.updateProfile = updateProfile;
const availableCaptains = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { data } = yield axios_1.default.get(`${BASE_URL}/api/captain/get-captains`);
        res.json({ captains: data });
    }
    catch (error) {
        res
            .status(503)
            .json({ message: error.message || "Failed to fetch captains" });
    }
});
exports.availableCaptains = availableCaptains;
const getUserDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.params.userId || req.query.userId;
        if (!userId) {
            res.status(400).json({ message: "User ID required" });
            return;
        }
        const user = yield user_model_1.default.findById(userId).select("name phone");
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.json(user);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: error.message || "Failed to fetch user details" });
    }
});
exports.getUserDetails = getUserDetails;
const getRideHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({ message: "Unauthorized: User not found" });
            return;
        }
        const response = yield axios_1.default.post(`${BASE_URL}/api/ride/ride-history`, {
            userId: req.user._id,
            status: "all",
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
[
    EVENT_TYPES.RIDE_ACCEPTED,
    EVENT_TYPES.RIDE_STARTED,
    EVENT_TYPES.RIDE_COMPLETED,
].forEach((event) => {
    subscribeToQueue(event, (msg) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const data = JSON.parse(msg);
            const userId = data.userId;
            if (userId) {
                yield (0, notification_1.notifyUser)(userId, event, data, "user");
            }
        }
        catch (err) {
            console.log(`Something wrong happened on server: ${err.message}`);
        }
    }));
});
