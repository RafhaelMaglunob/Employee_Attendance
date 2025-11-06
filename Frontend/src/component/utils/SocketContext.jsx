// src/component/utils/SocketContext.jsx
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    console.warn("useSocket must be used within SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const currentRoomRef = useRef(null);

  useEffect(() => {
    // Prevent multiple socket instances
    if (socketRef.current) return;

    // Initialize socket connection
    const newSocket = io("http://192.168.1.9:3001", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = newSocket;

    // Connection handlers
    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
      setIsConnected(true);

      // Auto-join appropriate room based on user type
      joinUserRoom(newSocket);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
      setIsConnected(false);
      currentRoomRef.current = null;
    });

    newSocket.on("connect_error", (error) => {
      console.error("🔴 Connection error:", error.message);
    });

    newSocket.on("reconnect", (attemptNumber) => {
      console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
      joinUserRoom(newSocket);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      console.log("🧹 Cleaning up socket connection");
      if (currentRoomRef.current) {
        newSocket.emit("leaveRoom", currentRoomRef.current);
      }
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Function to join appropriate room based on user type
  const joinUserRoom = (socketInstance) => {
    const employeeId = localStorage.getItem("employeeId");
    const adminId = localStorage.getItem("adminId"); // if you have admin ID

    let roomToJoin = null;

    // Employee takes priority if both exist (shouldn't happen)
    if (employeeId) {
      roomToJoin = `employee_${employeeId}`;
    } else if (adminId) {
      roomToJoin = `admin_${adminId}`;
    }

    // Leave old room if switching users
    if (currentRoomRef.current && currentRoomRef.current !== roomToJoin) {
      socketInstance.emit("leaveRoom", currentRoomRef.current);
      console.log(`🚪 Left room: ${currentRoomRef.current}`);
    }

    // Join new room
    if (roomToJoin) {
      socketInstance.emit("joinRoom", roomToJoin);
      currentRoomRef.current = roomToJoin;
      console.log(`📍 Joined room: ${roomToJoin}`);
    }
  };

  // Re-join room when user changes (e.g., login/logout)
  useEffect(() => {
    if (socket && isConnected) {
      joinUserRoom(socket);
    }
  }, [socket, isConnected]); // Watch for connection changes

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};  