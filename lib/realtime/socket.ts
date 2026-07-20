"use client";

import { io, type Socket } from "socket.io-client";

// Socket origin = the API's origin (NEXT_PUBLIC_API_URL includes the /api/v1
// path; socket.io lives at the server root).
const API = process.env.NEXT_PUBLIC_API_URL;

let socket: Socket | null = null;

/** Lazy client-side singleton. Null during SSR or when the API env is unset —
 *  callers must tolerate null (the app then just behaves as it does today). */
export function getSocket(): Socket | null {
  if (typeof window === "undefined" || !API) return null;
  if (!socket) {
    socket = io(new URL(API).origin, {
      transports: ["websocket"],
      reconnectionDelayMax: 10_000,
    });
  }
  return socket;
}
