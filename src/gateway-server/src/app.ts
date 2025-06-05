import express, { Request, Response } from "express";
import expressProxy from "express-http-proxy";
import cors from "cors";
const app = express();
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use("/api/user", expressProxy("http://localhost:8001"));
app.use("/api/captain", expressProxy("http://localhost:8002"));
app.use("/api/ride", expressProxy("http://localhost:8003"));

app.listen(8000, () => {
  console.log("Gateway server listening on port 8000");
});
