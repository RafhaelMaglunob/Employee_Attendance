// ./component/utils/socket.js
import { io } from "socket.io-client";

let socket;

export const initSocket = (employeeId) => {
  if (!socket) {
    socket = io("http://localhost:3001", {
      autoConnect: true, // immediately connect
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      if (employeeId) socket.emit("joinRoom", employeeId.toString());
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });
  } else if (employeeId) {
    socket.emit("joinRoom", employeeId.toString());
  }

  return socket;
};

export const getSocket = () => socket;
