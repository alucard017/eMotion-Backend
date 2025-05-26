import amqp, { Connection, Channel } from "amqplib";
import dotenv from "dotenv";

dotenv.config();
const RABBITMQ_URL = process.env.RABBIT_URL as string;

let connection: any = null;
let channel: Channel | null = null;
let connecting: Promise<void> | null = null;

interface RMQService {
  connect: () => Promise<void>;
  subscribeToQueue: (
    queueName: string,
    callback: (message: string) => void
  ) => Promise<void>;
  publishToQueue: (queueName: string, data: string) => Promise<void>;
}

async function connect(): Promise<void> {
  if (channel && connection) {
    return; // Already connected
  }
  if (connecting) {
    // If connection in progress, wait for it
    return connecting;
  }

  connecting = (async () => {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    console.log("Connected to RabbitMQ");
    connecting = null; // Reset after successful connection

    // Optionally handle connection close/errors
    connection.on("close", () => {
      console.warn("RabbitMQ connection closed");
      connection = null;
      channel = null;
    });
    connection.on("error", (err: any) => {
      console.error("RabbitMQ connection error", err);
      connection = null;
      channel = null;
    });
  })();

  return connecting;
}

async function subscribeToQueue(
  queueName: string,
  callback: (message: string) => void
): Promise<void> {
  if (!channel) await connect();
  await channel!.assertQueue(queueName, { durable: true });
  await channel!.consume(queueName, (message) => {
    if (message) {
      callback(message.content.toString());
      channel!.ack(message);
    }
  });
}

async function publishToQueue(queueName: string, data: string): Promise<void> {
  if (!channel) await connect();
  await channel!.assertQueue(queueName, { durable: true });
  channel!.sendToQueue(queueName, Buffer.from(data));
}

const rabbitMq: RMQService = { connect, subscribeToQueue, publishToQueue };
export default rabbitMq;
