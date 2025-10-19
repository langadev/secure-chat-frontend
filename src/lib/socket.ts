import { io, Socket } from "socket.io-client";
import { useAuthStore } from "./store";

let socket: Socket | null = null;

export function getSocket() {
  const token = useAuthStore.getState().accessToken;
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_API_WS || "http://localhost:3001", {
      path: "/ws",
      auth: { token },
      transports: ["websocket"],
    });
  }
  return socket;
}
