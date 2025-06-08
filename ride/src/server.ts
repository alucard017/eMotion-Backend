import dotenv from "dotenv";
import express, { Express } from "express";
import http from "http";
import cookieParser from "cookie-parser";
import connect from "./db/db";
import rideRoutes from "./routes/ride.routes";
import rabbitMq from "./service/rabbit";
import cors from "cors";
dotenv.config();

const app: Express = express();
connect();
rabbitMq.connect();

app.use(
  cors({
    origin: [
      "https://e-motion-eight.vercel.app/",
      "http://localhost:3001",
      "https://emotion-user.onrender.com",
      "https://emotion-captain.onrender.com",
      "https://emotion-websocket-server.onrender.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/", rideRoutes);

const server = http.createServer(app);

server.listen(8003, "0.0.0.0", () => {
  console.log("Ride service is running on port 8003");
});
