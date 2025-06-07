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
// Store clients by userId and role (to support multiple roles per user if needed)
const clients = new Map();
// Helper to log current connected clients count by role
function logClientsCount() {
    const userCount = Array.from(clients.values()).filter((c) => c.role === "user").length;
    const captainCount = Array.from(clients.values()).filter((c) => c.role === "captain").length;
    console.log(`Connected clients - Users: ${userCount}, Captains: ${captainCount}, Total: ${clients.size}`);
}
wss.on("connection", (ws, req) => {
    const parsedUrl = url_1.default.parse(req.url || "", true);
    const userId = parsedUrl.query.userId;
    const role = parsedUrl.query.role; // expecting "user" or "captain"
    if (!userId || !role || (role !== "user" && role !== "captain")) {
        console.warn(`Connection rejected. Missing or invalid userId/role. userId: ${userId}, role: ${role}`);
        ws.close(1008, "Missing or invalid userId or role");
        return;
    }
    // Prevent duplicate connections for same userId+role - close old connection
    const existingClient = clients.get(`${userId}_${role}`);
    if (existingClient) {
        console.log(`Closing existing connection for userId=${userId}, role=${role}`);
        existingClient.ws.close(1000, "New connection established");
    }
    clients.set(`${userId}_${role}`, { ws, userId, role });
    console.log(`[WS CONNECT] userId=${userId}, role=${role}`);
    logClientsCount();
    ws.on("close", (code, reason) => {
        console.log(`[WS DISCONNECT] userId=${userId}, role=${role}, code=${code}, reason=${reason.toString()}`);
        clients.delete(`${userId}_${role}`);
        logClientsCount();
    });
    ws.on("error", (error) => {
        console.error(`[WS ERROR] userId=${userId}, role=${role}`, error);
    });
    ws.on("message", (message) => {
        try {
            const msgStr = message.toString();
            console.log(`[WS MESSAGE] from userId=${userId}, role=${role}: ${msgStr}`);
            // Optional: handle incoming messages if needed
        }
        catch (err) {
            console.error(`[WS MESSAGE ERROR] userId=${userId}, role=${role}`, err);
        }
    });
});
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
app.post("/notify", (req, res) => {
    const { userId, role, event, data } = req.body;
    console.log("[NOTIFY REQUEST]", { userId, role, event, data });
    if (!userId || !event) {
        return res.status(400).json({ message: "userId and event are required" });
    }
    // If role is provided, use it; else try both roles
    if (role && (role === "user" || role === "captain")) {
        const client = clients.get(`${userId}_${role}`);
        if (client && client.ws.readyState === ws_1.default.OPEN) {
            client.ws.send(JSON.stringify({ event, data }));
            console.log(`[NOTIFY] Sent event "${event}" to userId=${userId}, role=${role}`);
            return res.json({
                message: `Event "${event}" sent to user ${userId} with role ${role}`,
            });
        }
        else {
            return res
                .status(404)
                .json({ message: `User ${userId} with role ${role} not connected` });
        }
    }
    else {
        // Send to all roles connected for userId (if role not specified)
        const rolesToNotify = ["user", "captain"];
        let sentToRoles = [];
        let notFoundRoles = [];
        for (const r of rolesToNotify) {
            const client = clients.get(`${userId}_${r}`);
            if (client && client.ws.readyState === ws_1.default.OPEN) {
                client.ws.send(JSON.stringify({ event, data }));
                sentToRoles.push(r);
            }
            else {
                notFoundRoles.push(r);
            }
        }
        if (sentToRoles.length > 0) {
            console.log(`[NOTIFY] Sent event "${event}" to userId=${userId} roles: ${sentToRoles.join(", ")}`);
            return res.json({
                message: `Event "${event}" sent to user ${userId} roles: ${sentToRoles.join(", ")}`,
            });
        }
        else {
            return res
                .status(404)
                .json({ message: `User ${userId} not connected on any role` });
        }
    }
});
server.on("request", app);
server.listen(PORT, () => {
    console.log(`WebSocket + HTTP server running on port ${PORT}`);
});
