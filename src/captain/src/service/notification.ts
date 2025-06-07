import axios from "axios";

const WS_SERVER_URL = process.env.WS_SERVER_URL || "http://localhost:8080";

export const notifyUser = async (userId: string, event: string, data: any) => {
  try {
    await axios.post(`${WS_SERVER_URL}/notify`, {
      userId,
      event,
      data,
    });
  } catch (error: any) {
    console.error(
      `Failed to notify user ${userId} via WebSocket:`,
      error.message
    );
  }
};
