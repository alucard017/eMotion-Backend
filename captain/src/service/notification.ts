import axios from "axios";

const WS_SERVER_URL = process.env.WS_SERVER_URL || "http://localhost:8080";

export const notifyUser = async (
  captainId: string,
  event: string,
  data: any,
  role?: "user" | "captain"
) => {
  try {
    await axios.post(`${WS_SERVER_URL}/notify`, {
      userId: captainId,
      event,
      data,
      ...(role ? { role } : {}),
    });
  } catch (error: any) {
    console.error(
      `Failed to notify user ${captainId} via WebSocket:`,
      error.message
    );
  }
};
