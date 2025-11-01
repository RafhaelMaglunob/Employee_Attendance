import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

export function useSocket() {
  const socketRef = useRef(null);

  if (!socketRef.current) {
    socketRef.current = io("http://localhost:3001", { autoConnect: false });
    socketRef.current.connect();
  }

  useEffect(() => {
    const socket = socketRef.current;

    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef.current;
}
