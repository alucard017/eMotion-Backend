import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import captainModel from "../models/captain.model";
import blacklisttokenModel from "../models/blacklisttoken.model";

interface AuthenticatedRequest extends Request {
  captain?: any;
}

export const captainAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401).json({ message: "Unauthorized: Token missing" });
      return;
    }
    const isBlacklisted = await blacklisttokenModel.findOne({ token });

    if (isBlacklisted) {
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

    const captain = await captainModel.findById((decoded as jwt.JwtPayload).id);

    if (!captain) {
      res.status(401).json({ message: "Unauthorized: Captain not found" });
      return;
    }

    req.captain = captain;
    console.log(`Captain is`, req.captain);
    next();
  } catch (error: any) {
    console.error("Captain Auth Middleware error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
