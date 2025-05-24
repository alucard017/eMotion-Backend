import dotenv from 'dotenv';
import express, { Express } from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import connect from './db/db';
import rideRoutes from './routes/ride.routes';
import rabbitMq from './service/rabbit';

dotenv.config();

const app: Express = express();
connect();
rabbitMq.connect();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/', rideRoutes);

const server = http.createServer(app);

server.listen(3003, () => {
    console.log('Ride service is running on port 3003');
});
