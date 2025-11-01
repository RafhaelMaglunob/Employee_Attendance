import { Server } from "socket.io";

let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: { origin: "*" }, // adjust for your frontend domain
  });

  io.on("connection", (socket) => {
    console.log("A client connected:", socket.id);

    // Listen for employee to join their own room
    socket.on("joinRoom", (employeeId) => {
      socket.join(employeeId);
      console.log(`Employee ${employeeId} joined room ${employeeId}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
}


// export io instance to use in routes
export function getIo() {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
}
