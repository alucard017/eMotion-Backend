import { Request, Response, NextFunction } from "express";
import rideModel from "../models/ride.model";
import rabbitMq from "../service/rabbit";
import { Types } from "mongoose";

const { publishToQueue } = rabbitMq;

interface AuthenticatedRequest extends Request {
  user?: { _id: string };
  captain?: { _id: string };
}

export const createRide = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { pickup, destination } = req.body;

    if (!req.user?._id) {
      res.status(401).json({ message: "Unauthorized: User not found" });
      return;
    }

    const newRide = new rideModel({
      user: req.user._id,
      pickup,
      destination,
      status: "requested",
    });

    await newRide.save();

    // Publish new ride event with ride id and other info
    publishToQueue("new-ride", JSON.stringify(newRide));

    res.status(201).send(newRide);
  } catch (error) {
    next(error);
  }
};

export const acceptRide = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const rideId = req.body.rideId as string;

    if (!rideId) {
      res.status(400).json({ message: "Ride ID is required" });
      return;
    }

    if (!req.captain?._id) {
      res.status(401).json({ message: "Unauthorized: Captain not found" });
      return;
    }

    const ride = await rideModel.findOneAndUpdate(
      { _id: rideId, status: "requested" },
      { status: "accepted", captain: new Types.ObjectId(req.captain._id) },
      { new: true }
    );

    if (!ride) {
      res.status(409).json({ message: "Ride already accepted or unavailable" });
      return;
    }

    publishToQueue("ride-accepted", JSON.stringify(ride));
    res.send(ride);
  } catch (error) {
    next(error);
  }
};

export const cancelRide = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rideId } = req.body;

    if (!req.user?._id) {
      res.status(401).json({ message: "Unauthorized: User not found" });
      return;
    }

    const ride = await rideModel.findById(rideId);

    if (!ride) {
      res.status(404).json({ message: "Ride not found" });
      return;
    }

    if (ride.user.toString() !== req.user._id.toString()) {
      res
        .status(403)
        .json({ message: "You are not allowed to cancel this ride" });
      return;
    }

    await ride.deleteOne();

    res.status(200).json({ message: "Ride cancelled successfully" });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Server error" });
  }
};

export const getRides = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.captain?._id) {
      res.status(401).json({ message: "Unauthorized: Captain not found" });
      return;
    }
    const { status } = req.query;

    const captainId = req.captain._id.toString();

    const query: any = { captain: captainId };
    if (status) query.status = status;

    // Fetch rides from Ride DB
    const rides = await rideModel
      .find(query)
      .populate("user", "name email")
      .populate("captain", "name email");

    res.json({ rides });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch rides" });
  }
};
