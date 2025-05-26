"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const amqplib_1 = __importDefault(require("amqplib"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const RABBITMQ_URL = process.env.RABBIT_URL;
let connection = null;
let channel = null;
let connecting = null;
function connect() {
    return __awaiter(this, void 0, void 0, function* () {
        if (channel && connection) {
            return; // Already connected
        }
        if (connecting) {
            // If connection in progress, wait for it
            return connecting;
        }
        connecting = (() => __awaiter(this, void 0, void 0, function* () {
            connection = yield amqplib_1.default.connect(RABBITMQ_URL);
            channel = yield connection.createChannel();
            console.log("Connected to RabbitMQ");
            connecting = null; // Reset after successful connection
            // Optionally handle connection close/errors
            connection.on("close", () => {
                console.warn("RabbitMQ connection closed");
                connection = null;
                channel = null;
            });
            connection.on("error", (err) => {
                console.error("RabbitMQ connection error", err);
                connection = null;
                channel = null;
            });
        }))();
        return connecting;
    });
}
function subscribeToQueue(queueName, callback) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!channel)
            yield connect();
        yield channel.assertQueue(queueName, { durable: true });
        yield channel.consume(queueName, (message) => {
            if (message) {
                callback(message.content.toString());
                channel.ack(message);
            }
        });
    });
}
function publishToQueue(queueName, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!channel)
            yield connect();
        yield channel.assertQueue(queueName, { durable: true });
        channel.sendToQueue(queueName, Buffer.from(data));
    });
}
const rabbitMq = { connect, subscribeToQueue, publishToQueue };
exports.default = rabbitMq;
