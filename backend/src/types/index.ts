import { Request } from "express";
import { Socket } from "socket.io";
import { JwtPayload } from "./auth.js";

// Express Request with Clerk user
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// Socket.IO with user data
export interface SocketWithUser extends Socket {
  userId?: string;
}

// Room types
export interface CreateRoomDto {
  name: string;
  description?: string;
}

export interface AddMemberDto {
  userId: string;
}

// Message types
export interface SendMessageDto {
  roomId: string;
  content: string;
}

export interface JoinRoomDto {
  roomId: string;
}

// Socket events
export interface ServerToClientEvents {
  "room-joined": (data: { roomId: string; messages: any[] }) => void;
  "new-message": (message: any) => void;
  "user-joined": (data: { userId: string }) => void;
  "user-left": (data: { userId: string }) => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  "join-room": (data: JoinRoomDto) => void;
  "leave-room": (roomId: string) => void;
  "send-message": (data: SendMessageDto) => void;
}
