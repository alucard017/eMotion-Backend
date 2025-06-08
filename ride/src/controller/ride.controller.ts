import { Request, Response, NextFunction } from "express";
import rideModel from "../models/ride.model";
import rabbitMq from "../service/rabbit";
import { Types } from "mongoose";
import axios from "axios";
import { notifyUser } from "../service/notification";

const { publishToQueue } = rabbitMq;
const USER_URL = process.env.USER_URL || "http://localhost:8001";
const CAPTAIN_URL = process.env.CAPTAIN_URL || "http://localhost:8002";
interface AuthenticatedRequest extends Request {
  user?: { _id: string };
  captain?: { _id: string };
}

const EVENT_TYPES = {
  RIDE_CREATED: "ride-created",
  RIDE_CANCELLED: "ride-cancelled",
  RIDE_ACCEPTED: "ride-accepted",
  RIDE_STARTED: "ride-started",
  RIDE_COMPLETED: "ride-completed",
};

export const createRide = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
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

    const userInfo = await getUserById(req.user._id);
    const enrichedRide = {
      ...newRide.toObject(),
      user: userInfo,
      captain: null,
    };

    await publishToQueue(
      EVENT_TYPES.RIDE_CREATED,
      JSON.stringify(enrichedRide)
    );
    await notifyUser(
      req.user._id,
      EVENT_TYPES.RIDE_CREATED,
      { ride: enrichedRide },
      "user"
    );

    res.status(201).send(enrichedRide);
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
    const rideId = req.body.rideId as string;
    const captainId = req.captain?._id;

    if (!rideId) {
      res.status(400).json({ message: "Ride ID is required" });
      return;
    }

    if (!captainId) {
      res.status(401).json({ message: "Unauthorized: Captain not found" });
      return;
    }

    const ride = await rideModel.findOneAndUpdate(
      { _id: rideId, status: "requested" },
      { status: "accepted", captain: new Types.ObjectId(captainId) },
      { new: true }
    );

    if (!ride) {
      res.status(409).json({ message: "Ride already accepted or unavailable" });
      return;
    }

    const captainDetails = await getCaptainById(captainId);

    const enrichedRide = {
      ...ride.toObject(),
      captain: {
        name: captainDetails.name,
        phone: captainDetails.phone,
        vehicle: captainDetails.vehicle,
      },
    };

    publishToQueue(EVENT_TYPES.RIDE_ACCEPTED, JSON.stringify(enrichedRide));
    await notifyUser(
      ride.user.toString(),
      EVENT_TYPES.RIDE_ACCEPTED,
      { ride: enrichedRide },
      "user"
    );

    res.send(enrichedRide);
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

    const userInfo = await getUserById(ride.user.toString());
    const captainInfo = ride.captain
      ? await getCaptainById(ride.captain.toString())
      : null;

    const enrichedRide = {
      ...ride.toObject(),
      user: userInfo,
      captain: captainInfo,
    };

    await publishToQueue(
      EVENT_TYPES.RIDE_CANCELLED,
      JSON.stringify(enrichedRide)
    );
    await notifyUser(
      req.user._id,
      EVENT_TYPES.RIDE_CANCELLED,
      { ride: enrichedRide },
      "user"
    );

    if (ride.captain) {
      await notifyUser(
        ride.captain.toString(),
        EVENT_TYPES.RIDE_CANCELLED,
        { ride: enrichedRide },
        "captain"
      );
    }

    res.send({ message: "Ride cancelled successfully", ride: enrichedRide });
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

    const captainDetails = await getCaptainById(req.captain._id);
    const enrichedRide = {
      ...ride.toObject(),
      captain: captainDetails,
    };

    publishToQueue(EVENT_TYPES.RIDE_STARTED, JSON.stringify(enrichedRide));
    await notifyUser(
      ride.user.toString(),
      EVENT_TYPES.RIDE_STARTED,
      { ride: enrichedRide },
      "user"
    );

    res.send(enrichedRide);
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

    const captainDetails = await getCaptainById(req.captain._id);
    const enrichedRide = {
      ...ride.toObject(),
      captain: captainDetails,
    };

    publishToQueue(EVENT_TYPES.RIDE_COMPLETED, JSON.stringify(enrichedRide));
    await notifyUser(
      ride.user.toString(),
      EVENT_TYPES.RIDE_COMPLETED,
      { ride: enrichedRide },
      "user"
    );

    res.send(enrichedRide);
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (userId: any) => {
  const { data } = await axios.get(`${USER_URL}/details/${userId}`);
  return { name: data.name, phone: data.phone };
};

export const getCaptainById = async (captainId: any) => {
  const { data } = await axios.get(`${CAPTAIN_URL}/details/${captainId}`);
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
    let { userId, captainId, status } = req.body;
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

    const rides = await rideModel.find(query).sort({ createdAt: -1 });
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

    res.json({ rides: enrichedRides });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch rides" });
  }
};

export const getCurrentRide = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { Id } = req.query;

    if (!Id || typeof Id !== "string") {
      res.status(400).json({ error: "Invalid or missing Id" });
      return;
    }
    let ride = await rideModel
      .findOne({
        $or: [{ user: Id }, { captain: Id }],
        status: { $in: ["requested", "accepted", "started", "completed"] },
      })
      .sort({ createdAt: -1 });
    if (!ride) {
      res.json({ ride: null });
      return;
    }
    const userInfo = ride?.user
      ? await getUserById(ride.user.toString())
      : null;
    const captainInfo = ride?.captain
      ? await getCaptainById(ride?.captain.toString())
      : null;

    const enrichedRide = {
      ...ride.toObject(),
      user: userInfo,
      captain: captainInfo,
    };

    res.json({
      ride: enrichedRide,
    });
  } catch (error) {
    console.error("Error fetching current ride:", error);
    res.status(500).json({ error: "Server error" });
  }
};
