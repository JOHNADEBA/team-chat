export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserStats {
  roomsCreated: number;
  roomsJoined: number;
  totalMessages: number;
  messagesByRoom?: {
    roomId: string;
    roomName: string;
    count: number;
  }[];
  recentActivity?: {
    type: 'message' | 'room_created' | 'room_joined';
    timestamp: Date;
    details: string;
  }[];
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
  token: string;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  members?: RoomMember[];
  messages?: Message[];
  lastMessage?: Message;
  createdBy?: User;
}

export interface RoomMember {
  id: string;
  userId: string;
  roomId: string;
  joinedAt: Date;
  lastRead: Date;
  user: User;
}

export interface Message {
  id: string;
  content: string;
  userId: string;
  roomId: string;
  createdAt: Date;
  updatedAt: Date;
  user: User;
}

export interface CreateRoomDto {
  name: string;
  description?: string;
}

export interface SendMessageDto {
  roomId: string;
  content: string;
}
export interface AddMemberDto {
  userId: string;
}
