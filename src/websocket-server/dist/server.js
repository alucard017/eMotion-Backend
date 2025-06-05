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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importStar(require("ws"));
const http_1 = __importDefault(require("http"));
const url_1 = __importDefault(require("url"));
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const PORT = 8080;
const server = http_1.default.createServer();
const wss = new ws_1.WebSocketServer({ server });
const clients = new Map();
wss.on("connection", (ws, req) => {
    const parsedUrl = url_1.default.parse(req.url || "", true);
    const userId = parsedUrl.query.userId;
    if (!userId) {
        ws.close(1008, "Missing userId");
        return;
    }
    console.log(`WebSocket connected: ${userId}`);
    clients.set(userId, ws);
    ws.on("close", () => {
        console.log(`WebSocket disconnected: ${userId}`);
        clients.delete(userId);
    });
    ws.on("error", (error) => {
        console.error(`WebSocket error for ${userId}:`, error);
    });
    ws.on("message", (message) => {
        console.log(`Message from ${userId}:`, message.toString());
    });
});
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
app.post("/notify", (req, res) => {
    const { userId, event, data } = req.body;
    if (!userId || !event) {
        return res.status(400).json({ message: "userId and event are required" });
    }
    const ws = clients.get(userId);
    if (ws && ws.readyState === ws_1.default.OPEN) {
        ws.send(JSON.stringify({ event, data }));
        return res.json({ message: `Event "${event}" sent to user ${userId}` });
    }
    else {
        return res.status(404).json({ message: `User ${userId} not connected` });
    }
});
server.on("request", app);
server.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`);
});
