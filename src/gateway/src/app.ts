import express, { Request, Response } from "express";
import expressProxy from "express-http-proxy";

const app = express();

app.use("/api/user", expressProxy("http://localhost:3001"));
app.use("/api/captain", expressProxy("http://localhost:3002"));
app.use("/api/ride", expressProxy("http://localhost:3003"));

app.listen(8000, () => {
  console.log("Gateway server listening on port 3000");
});
