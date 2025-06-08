import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import url from "url";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
const PORT = 8080;

const server = http.createServer();
const wss = new WebSocketServer({ server });

interface ClientInfo {
  ws: WebSocket;
  userId: string;
  role: "user" | "captain";
}

// Store clients by userId and role (to support multiple roles per user if needed)
const clients = new Map<string, ClientInfo>();

// Helper to log current connected clients count by role
function logClientsCount() {
  const userCount = Array.from(clients.values()).filter(
    (c) => c.role === "user"
  ).length;
  const captainCount = Array.from(clients.values()).filter(
    (c) => c.role === "captain"
  ).length;
  console.log(
    `Connected clients - Users: ${userCount}, Captains: ${captainCount}, Total: ${clients.size}`
  );
}

wss.on("connection", (ws, req) => {
  const parsedUrl = url.parse(req.url || "", true);
  const userId = parsedUrl.query.userId as string;
  const role = parsedUrl.query.role as string; // expecting "user" or "captain"

  if (!userId || !role || (role !== "user" && role !== "captain")) {
    console.warn(
      `Connection rejected. Missing or invalid userId/role. userId: ${userId}, role: ${role}`
    );
    ws.close(1008, "Missing or invalid userId or role");
    return;
  }

  // Prevent duplicate connections for same userId+role - close old connection
  const existingClient = clients.get(`${userId}_${role}`);
  if (existingClient) {
    console.log(
      `Closing existing connection for userId=${userId}, role=${role}`
    );
    existingClient.ws.close(1000, "New connection established");
  }

  clients.set(`${userId}_${role}`, { ws, userId, role });

  console.log(`[WS CONNECT] userId=${userId}, role=${role}`);
  logClientsCount();

  ws.on("close", (code, reason) => {
    console.log(
      `[WS DISCONNECT] userId=${userId}, role=${role}, code=${code}, reason=${reason.toString()}`
    );
    clients.delete(`${userId}_${role}`);
    logClientsCount();
  });

  ws.on("error", (error) => {
    console.error(`[WS ERROR] userId=${userId}, role=${role}`, error);
  });

  ws.on("message", (message) => {
    try {
      const msgStr = message.toString();
      console.log(
        `[WS MESSAGE] from userId=${userId}, role=${role}: ${msgStr}`
      );
      // Optional: handle incoming messages if needed
    } catch (err) {
      console.error(`[WS MESSAGE ERROR] userId=${userId}, role=${role}`, err);
    }
  });
});

const app = express();
app.use(bodyParser.json());
app.use(
  cors({
    origin: [
      "https://e-motion-eight.vercel.app/",
      "http://localhost:3001",
      "https://emotion-user.onrender.com",
      "https://emotion-captain.onrender.com",
      "https://emotion-ride.onrender.com",
      "https://emotion-gateway.onrender.com",
    ],
    credentials: true,
  })
);
app.post("/notify", (req: any, res: any) => {
  const { userId, role, event, data } = req.body;
  console.log("[NOTIFY REQUEST]", { userId, role, event, data });

  if (!userId || !event) {
    return res.status(400).json({ message: "userId and event are required" });
  }

  // If role is provided, use it; else try both roles
  if (role && (role === "user" || role === "captain")) {
    const client = clients.get(`${userId}_${role}`);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({ event, data }));
      console.log(
        `[NOTIFY] Sent event "${event}" to userId=${userId}, role=${role}`
      );
      return res.json({
        message: `Event "${event}" sent to user ${userId} with role ${role}`,
      });
    } else {
      return res
        .status(404)
        .json({ message: `User ${userId} with role ${role} not connected` });
    }
  } else {
    // Send to all roles connected for userId (if role not specified)
    const rolesToNotify = ["user", "captain"];
    let sentToRoles: string[] = [];
    let notFoundRoles: string[] = [];

    for (const r of rolesToNotify) {
      const client = clients.get(`${userId}_${r}`);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({ event, data }));
        sentToRoles.push(r);
      } else {
        notFoundRoles.push(r);
      }
    }

    if (sentToRoles.length > 0) {
      console.log(
        `[NOTIFY] Sent event "${event}" to userId=${userId} roles: ${sentToRoles.join(
          ", "
        )}`
      );
      return res.json({
        message: `Event "${event}" sent to user ${userId} roles: ${sentToRoles.join(
          ", "
        )}`,
      });
    } else {
      return res
        .status(404)
        .json({ message: `User ${userId} not connected on any role` });
    }
  }
});

server.on("request", app);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`WebSocket + HTTP server running on port ${PORT}`);
});
