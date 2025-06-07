import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userModel from "../models/user.model";
import blacklisttokenModel from "../models/blacklisttoken.model";
import rabbitMq from "../service/rabbit";
import axios from "axios";
import { notifyUser } from "../service/notification";

const { subscribeToQueue } = rabbitMq;
const BASE_URL = process.env.BASE_URL || "http://localhost:8000";

const EVENT_TYPES = {
  RIDE_ACCEPTED: "ride-accepted",
  RIDE_STARTED: "ride-started",
  RIDE_COMPLETED: "ride-completed",
};

interface UserRequest extends Request {
  user?: any;
}

function extractToken(req: Request): string | undefined {
  return req.cookies?.token || req.headers.authorization?.split(" ")[1];
}

function validateRegisterInput(body: any) {
  const { name, email, phone, password } = body;
  if (!name || !email || !phone || !password) return false;
  // TODO: Add regex/email/phone/password strength validation
  return true;
}

export const register = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  try {
    if (!validateRegisterInput(req.body)) {
      res.status(400).json({ message: "Missing or invalid fields" });
      return;
    }

    const { name, email, phone, password } = req.body;
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new userModel({
      name,
      email,
      phone,
      password: hashedPassword,
    });
    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id },
      process.env.JWT_SECRET as string,
      {
        expiresIn: "1h",
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    const { password: _, ...userWithoutPassword } = newUser.toObject();
    res.status(201).json({ token, user: userWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Registration failed" });
  }
};

export const login = async (req: UserRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ message: "Email and password required" });
      return;
    }

    const user = await userModel.findOne({ email }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET as string, {
      expiresIn: "1h",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    const { password: _, ...userWithoutPassword } = user.toObject();
    res.json({ token, user: userWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Login failed" });
  }
};

export const logout = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(400).json({ message: "No token found" });
      return;
    }

    await Promise.all([
      blacklisttokenModel.create({ token }),
      res.clearCookie("token"),
    ]);

    res.json({ message: "User logged out successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Logout failed" });
  }
};

export const profile = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    res.json({ user: req.user });
  } catch {
    res.status(500).json({ message: "Error fetching profile" });
  }
};

export const updateProfile = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { name, email, phone } = req.body;
    const user = await userModel.findById(req.user._id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;

    await user.save();

    const { password: _, ...userWithoutPassword } = user.toObject();
    res.json({
      message: "Profile updated successfully",
      user: userWithoutPassword,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Profile update failed" });
  }
};

export const getAvailableCaptains = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  try {
    const { data } = await axios.get(`${BASE_URL}/api/captain/get-captains`);
    res.json({ captains: data });
  } catch (error: any) {
    res
      .status(503)
      .json({ message: error.message || "Failed to fetch captains" });
  }
};

export const getUserDetails = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.params.userId || req.query.userId;
    if (!userId) {
      res.status(400).json({ message: "User ID required" });
      return;
    }

    const user = await userModel.findById(userId).select("name phone");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json(user);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to fetch user details" });
  }
};

export const getRideHistory = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user?._id) {
      res.status(401).json({ message: "Unauthorized: User not found" });
      return;
    }

    const response = await axios.post(
      `${BASE_URL}/api/ride/ride-history`,
      {
        userId: req.user._id,
        status: "all",
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

[
  EVENT_TYPES.RIDE_ACCEPTED,
  EVENT_TYPES.RIDE_STARTED,
  EVENT_TYPES.RIDE_COMPLETED,
].forEach((event) => {
  subscribeToQueue(event, async (msg: string) => {
    try {
      const data = JSON.parse(msg);
      const userId = data.userId;
      if (userId) {
        await notifyUser(userId, event, data, "user");
      }
    } catch (err: any) {
      console.log(`Something wrong happened on server: ${err.message}`);
    }
  });
});
