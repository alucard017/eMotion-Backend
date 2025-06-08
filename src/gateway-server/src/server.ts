import express from "express";
import expressProxy from "express-http-proxy";
import cors from "cors";
import rateLimit from "express-rate-limit";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "https://e-motion-eight.vercel.app/"],
    credentials: true,
  })
);

const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests to user API, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const captainLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests to captain API, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/user", userLimiter, expressProxy("http://localhost:8001"));
app.use("/api/captain", captainLimiter, expressProxy("http://localhost:8002"));

app.use("/api/ride", expressProxy("http://localhost:8003"));

app.listen(8000, () => {
  console.log("Gateway server listening on port 8000");
});
