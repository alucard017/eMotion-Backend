"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_http_proxy_1 = __importDefault(require("express-http-proxy"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: "http://localhost:3001",
    credentials: true,
}));
app.use("/api/user", (0, express_http_proxy_1.default)("http://localhost:8001"));
app.use("/api/captain", (0, express_http_proxy_1.default)("http://localhost:8002"));
app.use("/api/ride", (0, express_http_proxy_1.default)("http://localhost:8003"));
app.listen(8000, () => {
    console.log("Gateway server listening on port 8000");
});
