import mongoose, { Document, Schema } from "mongoose";

interface IRide extends Document {
  captain: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  pickup: string;
  destination: string;
  fare: number;
  status: "requested" | "accepted" | "started" | "completed";
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date;
}

const rideSchema: Schema<IRide> = new Schema(
  {
    captain: {
      type: mongoose.Schema.Types.ObjectId,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    pickup: {
      type: String,
      required: true,
    },
    destination: {
      type: String,
      required: true,
    },
    fare: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["requested", "accepted", "started", "completed"],
      default: "requested",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IRide>("Ride", rideSchema);
