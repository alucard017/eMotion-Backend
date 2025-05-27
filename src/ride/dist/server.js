"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const db_1 = __importDefault(require("./db/db"));
const ride_routes_1 = __importDefault(require("./routes/ride.routes"));
const rabbit_1 = __importDefault(require("./service/rabbit"));
const cors_1 = __importDefault(require("cors"));
dotenv_1.default.config();
const app = (0, express_1.default)();
(0, db_1.default)();
rabbit_1.default.connect();
app.use((0, cors_1.default)({
    origin: [
        "http://localhost:3001",
        "http://localhost:8001",
        "http://localhost:8002",
    ],
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
app.use("/", ride_routes_1.default);
const server = http_1.default.createServer(app);
server.listen(8003, () => {
    console.log("Ride service is running on port 8003");
});
