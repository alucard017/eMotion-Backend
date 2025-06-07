import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userModel from "../models/user.model";
import blacklisttokenModel from "../models/blacklisttoken.model";
import rabbitMq from "../service/rabbit";
import axios from "axios";
import { notifyUser } from "../service/notification";

const BASE_URL = process.env.BASE_URL || "http://localhost:4000";
const { subscribeToQueue } = rabbitMq;

interface UserRequest extends Request {
  user?: any;
}

export const register = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, email, phone, password } = req.body;
    const user = await userModel.findOne({ email });

    if (user) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const newUser = new userModel({ name, email, phone, password: hash });
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

    const cleanUser = newUser.toObject();
    const { password: _, ...userWithoutPassword } = cleanUser;
    res.send({ token, userWithoutPassword });
  } catch (error) {
    res.status(500).json({ message: "Unable to register User" });
  }
};

export const login = async (req: UserRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(400).json({ message: "Invalid email or password" });
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
    const cleanUser = user.toObject();
    const { password: _, ...userWithoutPassword } = cleanUser;
    res.send({ token, userWithoutPassword });
  } catch (error) {
    res.status(500).json({ message: "Unable to Signin" });
  }
};

export const logout = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
    await blacklisttokenModel.create({ token });
    res.clearCookie("token");
    res.send({ message: "User logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error while Logging out" });
  }
};

export const profile = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  try {
    res.send(req.user);
  } catch (error) {
    res.status(500).json({ message: "Error while fetching profile" });
  }
};

export const updateProfile = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, email, phone } = req.body;
    const user = await userModel.findById(req.user._id);

    if (!user) {
      res.status(404).json({ message: "Captain not found" });
      return;
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;

    await user.save();

    const cleanUser = user.toObject();
    const { password: _, ...userWithoutPassword } = cleanUser;

    res.json({
      message: "Profile updated successfully",
      captain: userWithoutPassword,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const availableCaptains = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/captain/get-captains`);
    if (!response.ok) {
      throw new Error("Captain service unavailable");
    }

    const data = await response.json();
    res.status(200).json({ captains: data });
  } catch (error) {
    console.error("Error fetching captains:", error);
    res.status(503).json({ message: "Unable to fetch captains" });
  }
};

export const getUserDetails = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  try {
    const id = req.params?.userId || req.query.userId;
    if (!id) {
      res.status(400).send("User ID (_id) required");
      return;
    }
    console.log(`User id for user details is: `, id);
    const user = await userModel.findById(id).select("name phone");
    if (!user) {
      res.status(404).send("User not found");
      return;
    }

    console.log(`User details:`, user);
    res.send(user);
  } catch (err: any) {
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch user details" });
  }
};

export const getRideHistory = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized: User not found" });
      return;
    }

    const response = await axios.post(
      `${BASE_URL}/api/ride/ride-history`,
      {
        status: "all",
        userId,
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
    console.error("Error fetching user ride history:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to fetch ride history" });
  }
};

subscribeToQueue("ride-accepted", async (msg: string) => {
  const data = JSON.parse(msg);
  const { userId } = data;
  if (userId) {
    await notifyUser(userId, "ride-accepted", data);
  }
});

subscribeToQueue("ride-started", async (msg: string) => {
  const data = JSON.parse(msg);
  const { userId } = data;
  if (userId) {
    await notifyUser(userId, "ride-started", data);
  }
});

subscribeToQueue("ride-completed", async (msg: string) => {
  const data = JSON.parse(msg);
  const { userId } = data;
  if (userId) {
    await notifyUser(userId, "ride-completed", data);
  }
});
