import { Request, Response, NextFunction } from "express";
import rideModel from "../models/ride.model";
import rabbitMq from "../service/rabbit";
import { Types } from "mongoose";
import axios from "axios";
import { notifyUser } from "../service/notification";

const { publishToQueue } = rabbitMq;
const BASE_URL = process.env.BASE_URL || "http://localhost:4000";

interface AuthenticatedRequest extends Request {
  user?: { _id: string };
  captain?: { _id: string };
}

export const createRide = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log(`createRide invoked`);
    const { pickup, destination, fare } = req.body;

    if (!req.user?._id) {
      res.status(401).json({ message: "Unauthorized: User not found" });
      return;
    }

    const newRide = new rideModel({
      user: req.user._id,
      pickup,
      destination,
      fare,
      status: "requested",
    });

    await newRide.save();
    await publishToQueue("ride-created", JSON.stringify(newRide));
    await notifyUser(req.user._id, "ride-created", newRide);

    res.status(201).send(newRide);
  } catch (error) {
    next(error);
  }
};

export const acceptRide = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log("Captain info from request:", req.captain);
    console.log("Request body: ", req.body);
    const rideId = req.body.rideId as string;
    console.log(`AcceptRide invoked and ride id is: ${rideId}`);
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

    console.log(`Ride is ${ride}`);
    if (!ride) {
      res.status(409).json({ message: "Ride already accepted or unavailable" });
      return;
    }

    publishToQueue("ride-accepted", JSON.stringify(ride));
    notifyUser(ride.user.toString(), "ride-accepted", ride);
    notifyUser(req.captain._id, "ride-accepted", ride);

    res.send(ride);
  } catch (error) {
    next(error);
  }
};

export const cancelRide = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rideId = req.body.rideId as string;

    if (!rideId) {
      res.status(400).json({ message: "Ride ID is required" });
      return;
    }

    if (!req.user?._id) {
      res.status(401).json({ message: "Unauthorized: User not found" });
      return;
    }

    const ride = await rideModel.findOneAndUpdate(
      {
        _id: rideId,
        status: "requested",
        user: new Types.ObjectId(req.user._id),
      },
      { status: "cancelled" },
      { new: true }
    );

    if (!ride) {
      res.status(409).json({ message: "Ride cannot be cancelled" });
      return;
    }

    publishToQueue("ride-cancelled", JSON.stringify(ride));
    notifyUser(req.user._id, "ride-cancelled", ride);

    res.send({ message: "Ride cancelled successfully", ride });
  } catch (error) {
    next(error);
  }
};

export const startRide = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log("Start ride invoked");
    const rideId = req.body.rideId as string;
    console.log("Ride id from start ride:", rideId);
    if (!rideId) {
      res.status(400).json({ message: "Ride ID is required" });
      return;
    }

    if (!req.captain?._id) {
      res.status(401).json({ message: "Unauthorized: Captain not found" });
      return;
    }

    const ride = await rideModel.findOneAndUpdate(
      {
        _id: rideId,
        status: "accepted",
        captain: new Types.ObjectId(req.captain._id),
      },
      { status: "started" },
      { new: true }
    );

    if (!ride) {
      res.status(409).json({ message: "Ride cannot be started" });
      return;
    }

    publishToQueue("ride-started", JSON.stringify(ride));
    notifyUser(ride.user.toString(), "ride-started", ride);
    notifyUser(req.captain._id, "ride-started", ride);

    res.send(ride);
  } catch (error) {
    next(error);
  }
};

export const endRide = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
      {
        _id: rideId,
        status: "started",
        captain: new Types.ObjectId(req.captain._id),
      },
      { status: "completed", completedAt: new Date() },
      { new: true }
    );

    if (!ride) {
      res.status(409).json({ message: "Ride cannot be ended" });
      return;
    }

    publishToQueue("ride-completed", JSON.stringify(ride));
    notifyUser(ride.user.toString(), "ride-completed", ride);
    notifyUser(req.captain._id, "ride-completed", ride);

    res.send(ride);
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (userId: any) => {
  const { data } = await axios.get(`${BASE_URL}/api/user/details/${userId}`);
  return { name: data.name, phone: data.phone };
};

export const getCaptainById = async (captainId: any) => {
  const { data } = await axios.get(
    `${BASE_URL}/api/captain/details/${captainId}`
  );
  return { name: data.name, phone: data.phone, vehicle: data.vehicle };
};

export const getRides = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rides = await rideModel.find({
      status: "requested",
    });

    const enrichedRides = await Promise.all(
      rides.map(async (ride) => {
        const userInfo = await getUserById(ride.user.toString());
        return {
          ...ride.toObject(),
          user: userInfo,
          captain: null,
        };
      })
    );
    res.json({ rides: enrichedRides });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch rides" });
  }
};

export const getRide = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    console.log("GetRide invoked");
    let { userId, captainId, status } = req.body;

    console.log(
      `Userid: ${userId}, CaptainId: ${captainId}, Status: ${status}`
    );
    if (
      status &&
      status !== "all" &&
      !["requested", "accepted", "started", "completed", "cancelled"].includes(
        status as string
      )
    ) {
      res.status(400).json({ message: "Invalid status query parameter" });
      return;
    }

    if (!userId && !captainId) {
      res
        .status(401)
        .json({ message: "Unauthorized: User or Captain not found" });
      return;
    }

    let query: any = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (userId) {
      query.user = userId;
    } else if (captainId) {
      if (status === "cancelled") {
        res.json({ rides: [] });
        return;
      }
      query.captain = captainId;
    }

    const rides = await rideModel.find(query);

    console.log("Rides are : ", rides);
    const enrichedRides = await Promise.all(
      rides.map(async (ride) => {
        const userInfo = ride.user
          ? await getUserById(ride.user.toString())
          : null;
        const captainInfo = ride.captain
          ? await getCaptainById(ride.captain.toString())
          : null;

        return {
          ...ride.toObject(),
          user: userInfo,
          captain: captainInfo,
        };
      })
    );

    console.log("Enriched Rides are: ", enrichedRides);
    res.json({ rides: enrichedRides });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch rides" });
  }
};
