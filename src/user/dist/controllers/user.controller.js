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
exports.getRideHistory = exports.getUserDetails = exports.rideEventListener = exports.availableCaptains = exports.updateProfile = exports.profile = exports.logout = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importDefault(require("../models/user.model"));
const blacklisttoken_model_1 = __importDefault(require("../models/blacklisttoken.model"));
const rabbit_1 = __importDefault(require("../service/rabbit"));
const events_1 = require("events");
const axios_1 = __importDefault(require("axios"));
const BASE_URL = process.env.BASE_URL || "http://localhost:4000";
const { subscribeToQueue } = rabbit_1.default;
const rideEventEmitter = new events_1.EventEmitter();
// interface IUser {
//   _id: string;
//   name: string;
//   email: string;
//   phone: number;
//   password: string;
//   _doc: any;
// }
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`User register invoked`);
        const { name, email, phone, password } = req.body;
        const user = yield user_model_1.default.findOne({ email });
        if (user) {
            res.status(400).json({ message: "User already exists" });
            return;
        }
        const hash = yield bcrypt_1.default.hash(password, 10);
        const newUser = new user_model_1.default({ name, email, phone, password: hash });
        yield newUser.save();
        const token = jsonwebtoken_1.default.sign({ id: newUser._id }, process.env.JWT_SECRET, {
            expiresIn: "1h",
        });
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });
        const cleanUser = newUser.toObject();
        const { password: _ } = cleanUser, userWithoutPassword = __rest(cleanUser, ["password"]);
        res.send({ token, userWithoutPassword });
    }
    catch (error) {
        res.status(500).json({ message: "Unable to register User" });
    }
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`User login invoked`);
        const { email, password } = req.body;
        const user = yield user_model_1.default.findOne({ email }).select("+password");
        if (!user || !(yield bcrypt_1.default.compare(password, user.password))) {
            res.status(400).json({ message: "Invalid email or password" });
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
        const cleanUser = user.toObject();
        const { password: _ } = cleanUser, userWithoutPassword = __rest(cleanUser, ["password"]);
        res.send({ token, userWithoutPassword });
    }
    catch (error) {
        res.status(500).json({ message: "Unable to Signin" });
    }
});
exports.login = login;
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        console.log(`User logout invoked`);
        const token = req.cookies.token || ((_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1]);
        yield blacklisttoken_model_1.default.create({ token });
        res.clearCookie("token");
        res.send({ message: "User logged out successfully" });
    }
    catch (error) {
        res.status(500).json({ message: "Error while Logging out" });
    }
});
exports.logout = logout;
const profile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`User profile GET invoked`);
        res.send(req.user);
    }
    catch (error) {
        res.status(500).json({ message: "Error while fetching profile" });
    }
});
exports.profile = profile;
const updateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`User profile POST invoked`);
        const { name, email, phone } = req.body;
        const user = yield user_model_1.default.findById(req.user._id);
        if (!user) {
            res.status(404).json({ message: "Captain not found" });
            return;
        }
        if (name)
            user.name = name;
        if (email)
            user.email = email;
        if (phone)
            user.phone = phone;
        yield user.save();
        const cleanUser = user.toObject();
        const { password: _ } = cleanUser, userWithoutPassword = __rest(cleanUser, ["password"]);
        res.json({
            message: "Profile updated successfully",
            captain: userWithoutPassword,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.updateProfile = updateProfile;
const availableCaptains = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const response = yield fetch(`${BASE_URL}/api/captain/get-captains`);
        if (!response.ok) {
            throw new Error("Captain service unavailable");
        }
        const data = yield response.json();
        res.status(200).json({ captains: data });
    }
    catch (error) {
        console.error("Error fetching captains:", error);
        res.status(503).json({ message: "Unable to fetch captains" });
    }
});
exports.availableCaptains = availableCaptains;
const rideEventListener = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log(`User rideEventListener invoked`);
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const eventType = req.query.event;
    if (!eventType || !["accepted", "started", "completed"].includes(eventType)) {
        res.status(400).json({ message: "Invalid or missing event type" });
        return;
    }
    let responded = false;
    const eventKey = `ride-${eventType}-${userId}`;
    const handler = (data) => {
        if (!responded) {
            responded = true;
            clearTimeout(timeout);
            res.send({ ride: data, event: eventType });
        }
    };
    const timeout = setTimeout(() => {
        if (!responded) {
            responded = true;
            rideEventEmitter.removeListener(eventKey, handler);
            res.status(204).send();
        }
    }, 30000);
    res.on("close", () => {
        if (!responded) {
            responded = true;
            clearTimeout(timeout);
            rideEventEmitter.removeListener(eventKey, handler);
        }
    });
    rideEventEmitter.once(eventKey, handler);
});
exports.rideEventListener = rideEventListener;
const getUserDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        console.log(`User getUserDetails Invoked`);
        const id = ((_a = req.params) === null || _a === void 0 ? void 0 : _a.userId) || req.query.userId;
        if (!id) {
            res.status(400).send("User ID (_id) required");
            return;
        }
        console.log(`Received user id is: ${id}`);
        const user = yield user_model_1.default.findById(id).select("name phone"); // use _id
        console.log(`fetched data ${user}`);
        if (!user) {
            res.status(404).send("User not found");
            return;
        }
        res.send(user);
    }
    catch (err) {
        res
            .status(500)
            .json({ message: err.message || "Failed to fetch user details" });
    }
});
exports.getUserDetails = getUserDetails;
const getRideHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized: User not found" });
            return;
        }
        const response = yield axios_1.default.post(`${BASE_URL}/api/ride/ride-history`, {
            status: "all",
            userId,
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
        console.error("Error fetching user ride history:", error);
        res
            .status(500)
            .json({ message: error.message || "Failed to fetch ride history" });
    }
});
exports.getRideHistory = getRideHistory;
subscribeToQueue("ride-accepted", (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const data = JSON.parse(msg);
    const { userId } = data;
    const eventKey = `ride-accepted-${userId}`;
    rideEventEmitter.emit(eventKey, data);
}));
subscribeToQueue("ride-started", (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const data = JSON.parse(msg);
    const { userId } = data;
    const eventKey = `ride-started-${userId}`;
    rideEventEmitter.emit(eventKey, data);
}));
subscribeToQueue("ride-completed", (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const data = JSON.parse(msg);
    const { userId } = data;
    const eventKey = `ride-completed-${userId}`;
    rideEventEmitter.emit(eventKey, data);
}));
