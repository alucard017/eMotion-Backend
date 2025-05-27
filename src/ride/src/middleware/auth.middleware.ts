import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import axios from "axios";

interface AuthenticatedRequest extends Request {
  user?: any;
  captain?: any;
}

export const userAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
    if (!token) {
      res.status(401).json({ message: "Unauthorized: Token missing" });
      return;
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    } catch (err) {
      res.status(401).json({ message: "Unauthorized: Invalid token" });
      return;
    }

    const response = await axios.get(
      `${process.env.BASE_URL}/api/user/profile`,
      {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const user = response.data.user || response.data;

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

export const captainAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401).json({ message: "Unauthorized: Token missing" });
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    } catch (err) {
      res.status(401).json({ message: "Unauthorized: Invalid token" });
      return;
    }

    const response = await axios.get(
      `${process.env.BASE_URL}/api/captain/profile`,
      {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const captain = response.data.captain || response.data;

    if (!captain) {
      res.status(401).json({ message: "Unauthorized: Captain not found" });
      return;
    }

    req.captain = captain;

    next();
  } catch (error: any) {
    console.error("Captain Auth Middleware error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const eitherAuth = async (
  req: Request & { user?: any; captain?: any },
  res: Response,
  next: NextFunction
) => {
  userAuth(req, res, (err?: any) => {
    if (!err && req.user) {
      return next();
    }
    captainAuth(req, res, (err2?: any) => {
      if (!err2 && req.captain) {
        return next();
      }
      return res
        .status(401)
        .json({ message: "Unauthorized: User or Captain required" });
    });
  });
};
