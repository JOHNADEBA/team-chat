import { Router, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AuthRequest, CreateRoomDto, AddMemberDto } from "../types/index.js";
import { validateAddMember, validateRoom } from "../middleware/validation.js";
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from "../utils/errors.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// Helper function to safely get string params
const getStringParam = (param: string | string[] | undefined): string => {
  if (typeof param === "string") return param;
  throw new ValidationError("Invalid parameter format");
};

// Get all rooms for user
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const rooms = await prisma.room.findMany({
      where: {
        members: {
          some: { userId: req.user.userId },
        },
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, email: true },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.json(rooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get room details
router.get(
  "/:roomId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const roomId = getStringParam(req.params.roomId);

      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          members: {
            include: {
              user: {
                select: { id: true, name: true, avatar: true, email: true },
              },
            },
          },
          messages: {
            take: 50,
            orderBy: { createdAt: "desc" },
            include: {
              user: {
                select: { id: true, name: true, avatar: true, email: true },
              },
            },
          },
        },
      });

      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      return res.json(room);
    } catch (error) {
      console.error("Error fetching room:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Create room
router.post(
  "/",
  authMiddleware,
  validateRoom,
  async (req: AuthRequest, res: Response) => {
    const { name, description } = req.body as CreateRoomDto;

    if (!req.user?.userId) {
      throw new UnauthorizedError();
    }

    // Create room with proper typing
    const roomData: any = {
      name,
      createdById: req.user.userId,
      members: {
        create: { userId: req.user.userId },
      },
    };

    // Only add description if it exists
    if (description) {
      roomData.description = description;
    }

    const room = await prisma.room.create({
      data: roomData,
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
      },
    });

    return res.json(room);
  },
);

// Add member to room
router.post(
  "/:roomId/members",
  authMiddleware,
  validateAddMember,
  async (req: AuthRequest, res: Response) => {
    try {
      const roomId = getStringParam(req.params.roomId);
      const { userId } = req.body as AddMemberDto;

      if (!req.user?.userId) {
        throw new UnauthorizedError();
      }

      // Check if user exists
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!userExists) {
        throw new NotFoundError("User");
      }

      // Check if already a member
      const existingMember = await prisma.roomMember.findUnique({
        where: {
          userId_roomId: {
            userId,
            roomId,
          },
        },
      });

      if (existingMember) {
        throw new ValidationError("User already a member of this room");
      }

      const member = await prisma.roomMember.create({
        data: {
          userId,
          roomId,
        },
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
        },
      });

      return res.json(member);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  },
);

// Remove member from room
router.delete(
  "/:roomId/members/:userId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const roomId = getStringParam(req.params.roomId);
      const userId = getStringParam(req.params.userId);

      if (!req.user?.userId) {
        throw new UnauthorizedError();
      }

      // Check if room exists
      const room = await prisma.room.findUnique({
        where: { id: roomId },
      });

      if (!room) {
        throw new NotFoundError("Room");
      }

      // Only room creator can remove members
      if (room.createdById !== req.user.userId) {
        throw new ForbiddenError("Only room creator can remove members");
      }

      // Can't remove the creator
      if (userId === room.createdById) {
        throw new ValidationError("Cannot remove room creator");
      }

      await prisma.roomMember.delete({
        where: {
          userId_roomId: {
            userId,
            roomId,
          },
        },
      });

      return res.json({
        success: true,
        message: "Member removed successfully",
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  },
);

// Delete room (creator only)
router.delete(
  "/:roomId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const roomId = getStringParam(req.params.roomId);

      if (!req.user?.userId) {
        throw new UnauthorizedError();
      }

      // Check if room exists and user is creator
      const room = await prisma.room.findUnique({
        where: { id: roomId },
      });

      if (!room) {
        throw new NotFoundError("Room");
      }

      if (room.createdById !== req.user.userId) {
        throw new ForbiddenError("Only room creator can delete the room");
      }

      // Delete in transaction to maintain data integrity
      await prisma.$transaction(async (tx) => {
        await tx.message.deleteMany({ where: { roomId } });
        await tx.roomMember.deleteMany({ where: { roomId } });
        await tx.room.delete({ where: { id: roomId } });
      });

      return res.json({ success: true, message: "Room deleted successfully" });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  },
);

export default router;
