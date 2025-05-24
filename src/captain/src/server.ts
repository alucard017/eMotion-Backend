import http from "http";
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connect from "./db/db";
import captainRoutes from "./routes/captain.routes";
import rabbitMq from "./service/rabbit";

dotenv.config();
const app = express();
connect();
rabbitMq.connect();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/", captainRoutes);

const server = http.createServer(app);
server.listen(3002, () => {
  console.log("captain service is running on port 3002");
});
