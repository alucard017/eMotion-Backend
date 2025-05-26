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
exports.acceptedRide = exports.updateProfile = exports.profile = exports.logout = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importDefault(require("../models/user.model"));
const blacklisttoken_model_1 = __importDefault(require("../models/blacklisttoken.model"));
const rabbit_1 = __importDefault(require("../service/rabbit"));
const events_1 = require("events");
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
        res.send(req.user);
    }
    catch (error) {
        res.status(500).json({ message: "Error while fetching profile" });
    }
});
exports.profile = profile;
const updateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
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
const acceptedRide = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    let responded = false;
    const eventKey = `ride-accepted-${userId}`;
    const handler = (data) => {
        if (!responded) {
            responded = true;
            clearTimeout(timeout);
            res.send(data);
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
exports.acceptedRide = acceptedRide;
subscribeToQueue("ride-accepted", (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const data = JSON.parse(msg);
    const { userId } = data;
    const eventKey = `ride-accepted-${userId}`;
    rideEventEmitter.emit(eventKey, data);
}));
