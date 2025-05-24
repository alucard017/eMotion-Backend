import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userModel from "../models/user.model";
import blacklisttokenModel from "../models/blacklisttoken.model";
import rabbitMq from "../service/rabbit";
import { EventEmitter } from "events";

const { subscribeToQueue } = rabbitMq;
const rideEventEmitter = new EventEmitter();

interface UserRequest extends Request {
  user?: any;
}

// interface IUser {
//   _id: string;
//   name: string;
//   email: string;
//   phone: number;
//   password: string;
//   _doc: any;
// }

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
export const acceptedRide = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  let responded = false;
  const eventKey = `ride-accepted-${userId}`;

  const handler = (data: any) => {
    if (!responded) {
      responded = true;
      clearTimeout(timeout);
      res.send(data);
    }
  };

  const timeout = setTimeout(() => {
    if (!responded) {
      responded = true;
      rideEventEmitter.removeListener(eventKey, handler);
      res.status(204).send();
    }
  }, 30000);

  res.on("close", () => {
    if (!responded) {
      responded = true;
      clearTimeout(timeout);
      rideEventEmitter.removeListener(eventKey, handler);
    }
  });

  rideEventEmitter.once(eventKey, handler);
};

subscribeToQueue("ride-accepted", async (msg: string) => {
  const data = JSON.parse(msg);
  const { userId } = data;
  const eventKey = `ride-accepted-${userId}`;
  rideEventEmitter.emit(eventKey, data);
});
