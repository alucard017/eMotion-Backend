"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = __importDefault(require("./db/db"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const rabbit_1 = __importDefault(require("./service/rabbit"));
dotenv_1.default.config();
const app = (0, express_1.default)();
(0, db_1.default)();
rabbit_1.default.connect();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
app.use('/', user_routes_1.default);
const server = http_1.default.createServer(app);
server.listen(3001, () => {
    console.log('User service is running on port 3001');
});
