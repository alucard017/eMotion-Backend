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
exports.eitherAuth = exports.captainAuth = exports.userAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const axios_1 = __importDefault(require("axios"));
const userAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const token = req.cookies.token || ((_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1]);
        if (!token) {
            res.status(401).json({ message: "Unauthorized: Token missing" });
            return;
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        }
        catch (err) {
            res.status(401).json({ message: "Unauthorized: Invalid token" });
            return;
        }
        const response = yield axios_1.default.get(`${process.env.BASE_URL}/api/user/profile`, {
            withCredentials: true,
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const user = response.data.user || response.data;
        if (!user) {
            res.status(401).json({ message: "Unauthorized: User not found" });
            return;
        }
        req.user = user;
        next();
    }
    catch (error) {
        console.error("User Auth Middleware error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.userAuth = userAuth;
const captainAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const token = req.cookies.token || ((_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1]);
        if (!token) {
            res.status(401).json({ message: "Unauthorized: Token missing" });
            return;
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        }
        catch (err) {
            res.status(401).json({ message: "Unauthorized: Invalid token" });
            return;
        }
        const response = yield axios_1.default.get(`${process.env.BASE_URL}/api/captain/profile`, {
            withCredentials: true,
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const captain = response.data.captain || response.data;
        if (!captain) {
            res.status(401).json({ message: "Unauthorized: Captain not found" });
            return;
        }
        req.captain = captain;
        next();
    }
    catch (error) {
        console.error("Captain Auth Middleware error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.captainAuth = captainAuth;
const eitherAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    (0, exports.userAuth)(req, res, (err) => {
        if (!err && req.user) {
            return next();
        }
        (0, exports.captainAuth)(req, res, (err2) => {
            if (!err2 && req.captain) {
                return next();
            }
            return res
                .status(401)
                .json({ message: "Unauthorized: User or Captain required" });
        });
    });
});
exports.eitherAuth = eitherAuth;
