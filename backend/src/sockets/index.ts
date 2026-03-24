import { Server as SocketIOServer } from "socket.io";
import { prisma } from "../lib/prisma.js";
import {
  SocketWithUser,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../types/index.js";

export const configureSockets = (
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
) => {
  // Socket.IO authentication middleware
  io.use(async (socket: SocketWithUser, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication required"));
      }

      // Decode token to get userId
      try {
        const base64Payload = token.split(".")[1];
        const payload = JSON.parse(
          Buffer.from(base64Payload, "base64").toString(),
        );
        socket.userId = payload.userId || payload.sub;
        next();
      } catch (e) {
        next(new Error("Invalid token"));
      }
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket: SocketWithUser) => {
    // Join room
    socket.on("join-room", async ({ roomId }) => {
      if (!socket.userId) return;

      // Leave all other rooms
      const rooms = Array.from(socket.rooms);
      rooms.forEach((room) => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });

      // Join new room
      socket.join(roomId);

      // Send recent messages
      const messages = await prisma.message.findMany({
        where: { roomId },
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, name: true, avatar: true, email: true },
          },
        },
      });

      socket.emit("room-joined", {
        roomId,
        messages: messages.reverse(),
      });

      // Notify others in the room
      socket.to(roomId).emit("user-joined", { userId: socket.userId });
    });

    // Send message
    socket.on("send-message", async ({ roomId, content }) => {
      if (!socket.userId) return;

      try {
        // Save message to database
        const message = await prisma.message.create({
          data: {
            content,
            roomId,
            userId: socket.userId,
          },
          include: {
            user: {
              select: { id: true, name: true, avatar: true, email: true },
            },
          },
        });

        // Broadcast to ALL users in the room (including sender)
        // NEW - Better pattern
        io.to(roomId).emit("new-message", {
          ...message,
          isOptimistic: false, // optional
          tempId: null,
        });
      } catch (error) {
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Leave room
    socket.on("leave-room", (roomId) => {
      if (!socket.userId) return;

      socket.leave(roomId);
      socket.to(roomId).emit("user-left", { userId: socket.userId });
    });

    // Handle disconnection
    socket.on("disconnect", () => {});
  });
};
