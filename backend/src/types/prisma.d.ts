import { Socket as NetSocket } from "net";

declare module "@prisma/client" {
  // Main Prisma Client class
  export class PrismaClient {
    constructor(options?: any);

    // Connection methods
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $on(event: string, callback: (event: any) => void): void;

    // Transaction support
    $transaction<P extends Promise<any>[]>(arg: [...P]): Promise<any>;
    $transaction<R>(
      fn: (prisma: PrismaClient) => Promise<R>,
      options?: { maxWait?: number; timeout?: number },
    ): Promise<R>;

    // Your models
    user: UserDelegate;
    room: RoomDelegate;
    roomMember: RoomMemberDelegate;
    message: MessageDelegate;
  }

  // Delegate types for each model with all Prisma methods
  export interface UserDelegate {
    findUnique(args: any): Promise<any>;
    findMany(args?: any): Promise<any[]>;
    create(args: any): Promise<any>;
    update(args: any): Promise<any>;
    delete(args: any): Promise<any>;
    upsert(args: any): Promise<any>;
    count(args?: any): Promise<number>;
    deleteMany(args?: any): Promise<number>;
    updateMany(args?: any): Promise<number>;
  }

  export interface RoomDelegate {
    findUnique(args: any): Promise<any>;
    findMany(args?: any): Promise<any[]>;
    create(args: any): Promise<any>;
    update(args: any): Promise<any>;
    delete(args: any): Promise<any>;
    upsert(args: any): Promise<any>;
    count(args?: any): Promise<number>;
    deleteMany(args?: any): Promise<number>;
    updateMany(args?: any): Promise<number>;
  }

  export interface RoomMemberDelegate {
    findUnique(args: any): Promise<any>;
    findMany(args?: any): Promise<any[]>;
    create(args: any): Promise<any>;
    update(args: any): Promise<any>;
    delete(args: any): Promise<any>;
    upsert(args: any): Promise<any>;
    count(args?: any): Promise<number>;
    deleteMany(args?: any): Promise<number>;
    updateMany(args?: any): Promise<number>;
  }

  export interface MessageDelegate {
    findUnique(args: any): Promise<any>;
    findMany(args?: any): Promise<any[]>;
    create(args: any): Promise<any>;
    update(args: any): Promise<any>;
    delete(args: any): Promise<any>;
    upsert(args: any): Promise<any>;
    count(args?: any): Promise<number>;
    deleteMany(args?: any): Promise<number>;
    updateMany(args?: any): Promise<number>;
  }

  // Re-export for convenience
  export type User = any;
  export type Room = any;
  export type RoomMember = any;
  export type Message = any;
}

// Extend NodeJS namespace for environment variables
declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    CLERK_SECRET_KEY: string;
    FRONTEND_URL?: string;
    PORT?: string;
    NODE_ENV?: "development" | "production" | "test";
  }
}
