import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import captainModel from "../models/captain.model";
import blacklisttokenModel from "../models/blacklisttoken.model";
import rabbitMq from "../service/rabbit";
import axios from "axios";
const { subscribeToQueue } = rabbitMq;
const BASE_URL = process.env.BASE_URL || "http://localhost:4000";

interface CaptainRequest extends Request {
  captain?: any;
}

const pendingRequests: Map<string, Response> = new Map();

export const register = async (
  req: CaptainRequest,
  res: Response
): Promise<void> => {
  try {
    console.log(`Captain Register Invoked`);
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

    const cleanCaptain = newCaptain.toObject();
    const { password: _, ...captainWithoutPassword } = cleanCaptain;

    res.send({ token, captain: captainWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (
  req: CaptainRequest,
  res: Response
): Promise<void> => {
  try {
    console.log(`Captain Login Invoked`);
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(404).json({ message: "Both fields are required" });
      return;
    }
    const captain = await captainModel.findOne({ email }).select("+password");

    if (!captain || !(await bcrypt.compare(password, captain.password))) {
      res.status(400).json({ message: "Invalid email or password" });
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

    const cleanCaptain = captain.toObject();
    const { password: _, ...captainWithoutPassword } = cleanCaptain;

    res.send({ token, captain: captainWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const logout = async (
  req: CaptainRequest,
  res: Response
): Promise<void> => {
  try {
    console.log(`Captain Logout Invoked`);
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
    // console.log(req.captain);
    const captainId = req.captain?._id;
    if (captainId) {
      await captainModel.findByIdAndUpdate(captainId, { isAvailable: false });
      // console.log(`LOGOUT isavailable set false`);
    }
    await blacklisttokenModel.create({ token });

    res.clearCookie("token");

    res.send({ message: "Captain logged out successfully and set offline" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const profile = async (
  req: CaptainRequest,
  res: Response
): Promise<void> => {
  try {
    console.log(`Captain Profile GET Invoked`);
    res.send(req.captain);
  } catch (error: any) {
    res.status(500).json({ message: "Error while fetching profile" });
  }
};

export const updateProfile = async (
  req: CaptainRequest,
  res: Response
): Promise<void> => {
  try {
    console.log(`Captain Profile POST Invoked`);
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

    const cleanCaptain = captain.toObject();
    const { password: _, ...captainWithoutPassword } = cleanCaptain;

    res.json({
      message: "Profile updated successfully",
      captain: captainWithoutPassword,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleAvailability = async (
  req: CaptainRequest,
  res: Response
): Promise<void> => {
  try {
    console.log(`Captain Toggle Availability Invoked`);
    const captain = await captainModel.findById(req.captain._id);
    if (!captain) {
      res.status(404).json({ message: "Captain not found" });
      return;
    }

    captain.isAvailable = !captain.isAvailable;
    await captain.save();
    res.send(captain);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAvailableCaptains = async (
  req: Request,
  res: Response
): Promise<void> => {
  console.log(`Captain getAvailableCaptains invoked`);

  try {
    const captains = await captainModel.find({ isAvailable: true }).select(
      "-password" // exclude password
    );

    res.status(200).json(captains);
  } catch (error) {
    console.error("Error fetching available captains:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const waitForNewRide = async (req: CaptainRequest, res: Response) => {
  console.log(`Captain Wait For new Ride invoked`);
  const captainId = String(req.captain?._id);

  // Clear previous pending request if exists (optional)
  const previous = pendingRequests.get(captainId);
  if (previous && !previous.writableEnded) {
    previous.status(204).end();
  }

  pendingRequests.set(captainId, res);

  const timeout = setTimeout(() => {
    // Only delete if current response is still the same
    if (pendingRequests.get(captainId) === res) {
      pendingRequests.delete(captainId);
      res.status(204).end();
    }
  }, 30000);

  res.on("close", () => {
    clearTimeout(timeout);
    // Only delete if current response is still the same
    if (pendingRequests.get(captainId) === res) {
      pendingRequests.delete(captainId);
    }
  });
};

export const getAllRideRequests = async (
  req: CaptainRequest,
  res: Response
) => {
  try {
    console.log(`Captain GetAllRideRequests invoked`);
    const token =
      req.cookies?.token || req.headers?.authorization?.split(" ")[1];
    const response = await axios.get(`${BASE_URL}/api/ride/rides`, {
      params: { status: "requested" },
      withCredentials: true,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Assuming ride service responds with { rides: [...] }
    const rides = response.data.rides;

    res.json({ rides });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to fetch ride requests" });
  }
};

subscribeToQueue("new-ride", (data: string) => {
  const rideData = JSON.parse(data);
  const captainId = rideData.captainId;
  const res = pendingRequests.get(captainId);
  if (res) {
    res.json(rideData);
    pendingRequests.delete(captainId);
  }
});
