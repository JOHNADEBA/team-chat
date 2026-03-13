import express, { Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Import routes
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/users.js";
import roomRoutes from "./routes/rooms.js";
import { configureSockets } from "./sockets/index.js";

// Import middleware
import { errorHandler } from "./middleware/errorHandler.js";

// Import types
import { ServerToClientEvents, ClientToServerEvents } from "./types/index.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:4200",
    credentials: true,
  }),
);
app.use(express.json());

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Serve Angular static files in production
if (process.env.NODE_ENV === "production") {
  // FIX: Koyeb expects the public directory differently
  const angularDistPath = path.join(__dirname, "../public"); // or "../dist/browser"

  // Check if directory exists before serving (optional)
  app.use(express.static(angularDistPath));

  // All non-API routes serve Angular index.html
  app.get("*", (req: Request, res: Response) => {
    if (!req.path.startsWith("/api") && !req.path.startsWith("/uploads")) {
      res.sendFile(path.join(angularDistPath, "index.html"));
    }
  });
}

// Socket.IO setup - Koyeb supports this perfectly!
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:4200",
    credentials: true,
  },
  transports: ["websocket", "polling"],
  // Add for production stability
  pingTimeout: 60000,
  pingInterval: 25000,
});

configureSockets(io);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/rooms", roomRoutes);

// Health check - Koyeb uses this for monitoring
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler for undefined API routes
app.use((req: Request, res: Response) => {
  if (req.path.startsWith("/api")) {
    res
      .status(404)
      .json({ error: `Route ${req.method} ${req.path} not found` });
  }
});

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  // Only log in development
  if (process.env.NODE_ENV !== "production") {
    console.log(`🚀 Server running on port ${PORT}`);
  }
});
