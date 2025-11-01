import { Server } from "socket.io";

let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log("🔌 A client connected:", socket.id);

    socket.on("joinRoom", (room) => {
      socket.join(room);
      console.log(`✅ ${socket.id} joined room: ${room}`);
    });

    socket.on("leaveRoom", (room) => {
      socket.leave(room);
      console.log(`🚪 ${socket.id} left room: ${room}`);
    });

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });

  return io;
}

export function getIo() {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
}