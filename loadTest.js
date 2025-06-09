import http from "k6/http";
import ws from "k6/ws";
import { check, sleep, fail } from "k6";

const BASE_URL = "http://127.0.0.1:8005";
const WS_URL = "ws://127.0.0.1:8080/ws";

export const options = {
  vus: 30,
  duration: "15m",
  noConnectionReuse: false,
};

// One-time setup for login and token generation
export function setup() {
  const headers = {
    "Content-Type": "application/json",
    Connection: "keep-alive",
  };

  const userLogin = http.post(
    `${BASE_URL}/api/user/login`,
    JSON.stringify({ email: "user@demo.com", password: "password" }),
    { headers }
  );

  check(userLogin, {
    "User login success": (res) => res.status === 200,
  }) || fail("User login failed");

  const captainLogin = http.post(
    `${BASE_URL}/api/captain/login`,
    JSON.stringify({ email: "captain@demo.com", password: "password" }),
    { headers }
  );

  check(captainLogin, {
    "Captain login success": (res) => res.status === 200,
  }) || fail("Captain login failed");

  return {
    userToken: userLogin.json("token"),
    captainToken: captainLogin.json("token"),
    userId: userLogin.json("user.id") || userLogin.json("user._id"),
  };
}

// Main test per virtual user
export default function (data) {
  // WebSocket URLs with query parameters for auth
  const userWsUrl = `${WS_URL}/?userId=${encodeURIComponent(
    data.userId
  )}&role=user`;
  const captainWsUrl = `${WS_URL}/?userId=${encodeURIComponent(
    data.userId
  )}&role=captain`;

  // User WebSocket connection
  ws.connect(userWsUrl, null, function (userSocket) {
    userSocket.on("open", () => {
      console.log("User WebSocket connected");

      // Captain WebSocket connection nested here so that both are open before HTTP flow
      ws.connect(captainWsUrl, null, function (captainSocket) {
        captainSocket.on("open", () => {
          console.log("Captain WebSocket connected");

          // Now do HTTP requests
          const userHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.userToken}`,
            Connection: "keep-alive",
          };

          const captainHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.captainToken}`,
            Connection: "keep-alive",
          };

          const rideCreatePayload = JSON.stringify({
            pickup: "Location A",
            destination: "Location B",
            fare: 100,
          });

          sleep(1); // small delay before starting HTTP requests

          const createRes = http.post(
            `${BASE_URL}/api/ride/create-ride`,
            rideCreatePayload,
            { headers: userHeaders }
          );
          check(createRes, { "Ride created (201)": (r) => r.status === 201 }) ||
            fail("Ride creation failed");

          const rideId = createRes.json("_id");
          if (!rideId) {
            fail("Ride ID not found");
            return;
          }

          const ridePayload = JSON.stringify({ rideId });

          sleep(0.5);

          const acceptRes = http.post(
            `${BASE_URL}/api/ride/accept-ride`,
            ridePayload,
            {
              headers: captainHeaders,
            }
          );
          check(acceptRes, {
            "Ride accepted (200)": (r) => r.status === 200,
          }) || fail("Ride accept failed");

          sleep(0.5);

          const startRes = http.post(
            `${BASE_URL}/api/ride/start-ride`,
            ridePayload,
            {
              headers: captainHeaders,
            }
          );
          check(startRes, { "Ride started (200)": (r) => r.status === 200 }) ||
            fail("Ride start failed");

          sleep(0.5);

          const endRes = http.post(
            `${BASE_URL}/api/ride/end-ride`,
            ridePayload,
            {
              headers: captainHeaders,
            }
          );
          check(endRes, { "Ride ended (200)": (r) => r.status === 200 }) ||
            fail("Ride end failed");

          sleep(0.5);

          const historyPayload = JSON.stringify({
            userId: data.userId,
            status: "all",
          });

          const historyRes = http.post(
            `${BASE_URL}/api/ride/ride-history`,
            historyPayload,
            { headers: userHeaders }
          );
          check(historyRes, {
            "History fetched (200)": (r) => r.status === 200,
          }) || fail("Ride history failed");

          sleep(1); // Final cooldown

          // Close sockets after work done
          captainSocket.close();
          userSocket.close();
        });

        captainSocket.on("close", () => {
          console.log("Captain WebSocket disconnected");
        });

        captainSocket.on("error", (e) => {
          console.error("Captain WebSocket error:", e);
        });
      });
    });

    userSocket.on("close", () => {
      console.log("User WebSocket disconnected");
    });

    userSocket.on("error", (e) => {
      console.error("User WebSocket error:", e);
    });
  });
}
