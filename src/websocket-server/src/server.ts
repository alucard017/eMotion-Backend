import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import url from "url";
import express from "express";
import bodyParser from "body-parser";

const PORT = 8080;

const server = http.createServer();
const wss = new WebSocketServer({ server });

const clients = new Map<string, WebSocket>();

wss.on("connection", (ws, req) => {
  const parsedUrl = url.parse(req.url || "", true);
  const userId = parsedUrl.query.userId as string;

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

const app = express();
app.use(bodyParser.json());

app.post("/notify", (req: any, res: any) => {
  const { userId, event, data } = req.body;

  if (!userId || !event) {
    return res.status(400).json({ message: "userId and event are required" });
  }

  const ws = clients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, data }));
    return res.json({ message: `Event "${event}" sent to user ${userId}` });
  } else {
    return res.status(404).json({ message: `User ${userId} not connected` });
  }
});

server.on("request", app);

server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
