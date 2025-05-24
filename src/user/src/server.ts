import http from 'http';
import express, { Application } from 'express';
import dotenv from 'dotenv';
import connect from './db/db';
import userRoutes from './routes/user.routes';
import cookieParser from 'cookie-parser';
import rabbitMq from './service/rabbit';

dotenv.config();

const app: Application = express();

connect();
rabbitMq.connect();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/', userRoutes);

const server = http.createServer(app);

server.listen(3001, () => {
    console.log('User service is running on port 3001');
});
