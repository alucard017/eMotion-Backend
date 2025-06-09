import http from "http";
import express, { Application } from "express";
import dotenv from "dotenv";
import connect from "./db/db";
import userRoutes from "./routes/user.routes";
import cookieParser from "cookie-parser";
import rabbitMq from "./service/rabbit";
import cors from "cors";
dotenv.config();

const app: Application = express();

connect();
rabbitMq.connect();

app.use(
  cors({
    origin: [
      "https://e-motion-eight.vercel.app/",
      "http://localhost:3001",
      "https://distros.tech",
      "http://distros.tech",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// app.use("/", userRoutes); //for gateway
app.use("/api/user/", userRoutes);

const server = http.createServer(app);

server.listen(8001, "0.0.0.0", () => {
  console.log("User service is running on port 8001");
});
