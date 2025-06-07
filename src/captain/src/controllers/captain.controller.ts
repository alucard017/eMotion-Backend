import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import captainModel from "../models/captain.model";
import blacklisttokenModel from "../models/blacklisttoken.model";
import rabbitMq from "../service/rabbit";
import axios from "axios";
import { notifyUser } from "../service/notification";

const { subscribeToQueue } = rabbitMq;
const BASE_URL = process.env.BASE_URL || "http://localhost:8000";

const EVENT_TYPES = {
  RIDE_CREATED: "ride-created",
  RIDE_CANCELLED: "ride-cancelled",
};

const RIDE_STATUS = {
  ALL: "all",
};

interface CaptainRequest extends Request {
  captain?: any;
}

function extractToken(req: Request): string | undefined {
  return req.cookies?.token || req.headers.authorization?.split(" ")[1];
}

// Basic input validation placeholder (extend as needed)
function validateRegisterInput(body: any) {
  const { name, email, phone, vehicle, password } = body;
  if (!name || !email || !phone || !vehicle || !password) {
    return false;
  }
  // TODO: Add regex/email/phone/password strength validation
  return true;
}

export const register = async (
  req: CaptainRequest,
  res: Response
): Promise<void> => {
  try {
    if (!validateRegisterInput(req.body)) {
      res.status(400).json({ message: "Missing or invalid fields" });
      return;
    }

    const { name, email, phone, vehicle, password } = req.body;

    const existingCaptain = await captainModel.findOne({ email });
    if (existingCaptain) {
      res.status(400).json({ message: "Captain already exists" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newCaptain = new captainModel({
      name,
      email,
      phone,
      vehicle,
      password: hashedPassword,
    });

    await newCaptain.save();

    const token = jwt.sign(
      { id: newCaptain._id },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    const { password: _, ...captainWithoutPassword } = newCaptain.toObject();

    res.status(201).json({ token, captain: captainWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Registration failed" });
  }
};

export const login = async (
  req: CaptainRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ message: "Email and password required" });
      return;
    }

    const captain = await captainModel.findOne({ email }).select("+password");
    if (!captain || !(await bcrypt.compare(password, captain.password))) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = jwt.sign(
      { id: captain._id },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    const { password: _, ...captainWithoutPassword } = captain.toObject();

    res.json({ token, captain: captainWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Login failed" });
  }
};

export const logout = async (
  req: CaptainRequest,
  res: Response
): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(400).json({ message: "No token found" });
      return;
    }

    if (req.captain?._id) {
      await captainModel.findByIdAndUpdate(req.captain._id, {
        isAvailable: false,
      });
    }
    await Promise.all([
      blacklisttokenModel.create({ token }),
      res.clearCookie("token"),
    ]);

    res.json({ message: "Captain logged out successfully and set offline" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Logout failed" });
  }
};

export const profile = async (
  req: CaptainRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.captain) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    res.json({ captain: req.captain });
  } catch (error: any) {
    res.status(500).json({ message: "Error while fetching profile" });
  }
};

export const updateProfile = async (
  req: CaptainRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.captain) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { name, email, phone, vehicle } = req.body;

    const captain = await captainModel.findById(req.captain._id);
    if (!captain) {
      res.status(404).json({ message: "Captain not found" });
      return;
    }

    if (name) captain.name = name;
    if (email) captain.email = email;
    if (phone) captain.phone = phone;
    if (vehicle) captain.vehicle = vehicle;

    await captain.save();

    const { password: _, ...captainWithoutPassword } = captain.toObject();

    res.json({
      message: "Profile updated successfully",
      captain: captainWithoutPassword,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Profile update failed" });
  }
};

export const toggleAvailability = async (
  req: CaptainRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.captain) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const updatedCaptain = await captainModel.findByIdAndUpdate(
      req.captain._id,
      [{ $set: { isAvailable: { $not: "$isAvailable" } } }], // atomic toggle with aggregation pipeline update
      { new: true }
    );

    if (!updatedCaptain) {
      res.status(404).json({ message: "Captain not found" });
      return;
    }

    res.json({ isAvailable: updatedCaptain.isAvailable });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to toggle availability" });
  }
};

export const getAvailableCaptains = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const captains = await captainModel
      .find({ isAvailable: true })
      .select("-password");
    res.json({ captains });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};

export const getCaptainDetails = async (req: CaptainRequest, res: Response) => {
  try {
    const captainId = req.params?.captainId || req.query.captainId;
    if (!captainId) {
      res.status(400).json({ message: "Captain ID required" });
      return;
    }

    const captain = await captainModel
      .findById(captainId)
      .select("name phone vehicle");
    if (!captain) {
      res.status(404).json({ message: "Captain not found" });
      return;
    }

    res.json({ captain });
  } catch (err: any) {
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch captain details" });
  }
};

export const getAllRideRequests = async (
  req: CaptainRequest,
  res: Response
) => {
  try {
    const response = await axios.get(`${BASE_URL}/api/ride/rides`);
    const rides = response.data.rides || [];
    res.json({ rides });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to fetch ride requests" });
  }
};

export const getRideHistory = async (
  req: CaptainRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.captain?._id) {
      res.status(401).json({ message: "Unauthorized: Captain not found" });
      return;
    }

    const response = await axios.post(
      `${BASE_URL}/api/ride/ride-history`,
      {
        captainId: req.captain._id,
        status: RIDE_STATUS.ALL,
      },
      {
        withCredentials: true,
        headers: {
          Authorization: req.headers.authorization || "",
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to fetch ride history" });
  }
};

[EVENT_TYPES.RIDE_CREATED, EVENT_TYPES.RIDE_CANCELLED].forEach((event) => {
  subscribeToQueue(event, async (msg: string) => {
    try {
      const data = JSON.parse(msg);
      const captainId = data.captainId;
      if (captainId) {
        await notifyUser(captainId, event, data, "captain");
      }
    } catch (err: any) {
      console.log(`Something wrong happened on server: ${err.message}`);
    }
  });
});
