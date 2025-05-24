import amqp, { Connection, Channel } from "amqplib";
import dotenv from "dotenv";

dotenv.config();
const RABBITMQ_URL = process.env.RABBIT_URL as string;

let connection: Connection;
let channel: Channel;

interface RMQService {
  connect: () => Promise<void>;
  subscribeToQueue: (
    queueName: string,
    callback: (message: string) => void
  ) => Promise<void>;
  publishToQueue: (queueName: string, data: string) => Promise<void>;
}

async function connect(): Promise<void> {
  if (connection && channel) {
    return; // Already connected
  }
  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  console.log("Connected to RabbitMQ");
}

async function subscribeToQueue(
  queueName: string,
  callback: (message: string) => void
): Promise<void> {
  if (!channel) await connect();
  await channel.assertQueue(queueName, { durable: true });
  await channel.consume(queueName, (message) => {
    if (message) {
      callback(message.content.toString());
      channel.ack(message);
    }
  });
}

async function publishToQueue(queueName: string, data: string): Promise<void> {
  if (!channel) await connect();
  await channel.assertQueue(queueName, { durable: true });
  channel.sendToQueue(queueName, Buffer.from(data));
}

const rabbitMq: RMQService = { connect, subscribeToQueue, publishToQueue };
export default rabbitMq;
