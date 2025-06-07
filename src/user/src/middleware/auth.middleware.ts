import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import userModel from "../models/user.model";
import blacklisttokenModel from "../models/blacklisttoken.model";

interface AuthenticatedRequest extends Request {
  user?: any;
}

export const userAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401).json({ message: "Unauthorized: No Token found" });
      return;
    }

    const isBlacklisted = await blacklisttokenModel.find({ token });

    if (isBlacklisted.length) {
      res.status(401).json({ message: "Unauthorized: Invalid Token" });
      return;
    }

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    } catch (err) {
      res.status(401).json({ message: "Unauthorized: Invalid token" });
      return;
    }

    const user = await userModel.findById((decoded as jwt.JwtPayload).id);

    if (!user) {
      res.status(401).json({ message: "Unauthorized: User not found" });
      return;
    }

    req.user = user;

    next();
  } catch (error: any) {
    console.error("User Auth Middleware error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
