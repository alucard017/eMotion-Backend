import http from "http";
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connect from "./db/db";
import captainRoutes from "./routes/captain.routes";
import rabbitMq from "./service/rabbit";
import cors from "cors";

dotenv.config();
const app = express();
connect();
rabbitMq.connect();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "https://e-motion-eight.vercel.app/",
      "http://localhost:3001",
      "https://emotion-user.onrender.com",
      "https://emotion-websocket-server.onrender.com",
      "https://emotion-ride.onrender.com",
    ],
    credentials: true,
  })
);
app.use("/", captainRoutes);

const server = http.createServer(app);
server.listen(8002, "0.0.0.0", () => {
  console.log("captain service is running on port 8002");
});
