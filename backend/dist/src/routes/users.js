import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { ValidationError } from "../utils/errors.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = Router();
// Helper function to safely get string params
const getStringParam = (param) => {
    if (typeof param === "string")
        return param;
    throw new ValidationError("Invalid parameter format");
};
// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const uploadDir = path.join(__dirname, "../../uploads/avatars");
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${uniqueSuffix}${ext}`);
    },
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (_req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed."));
        }
    },
});
router.get("/me", authMiddleware, async (req, res) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                createdAt: true,
                rooms: {
                    include: {
                        room: true,
                    },
                },
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.json(user);
    }
    catch (error) {
        const err = error;
        console.error("Error fetching user:", err);
        return res.status(500).json({ error: err.message });
    }
});
router.get("/search", authMiddleware, async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.length < 2) {
            return res.json([]);
        }
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { email: { contains: query, mode: "insensitive" } },
                ],
            },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
            },
            take: 10,
        });
        return res.json(users);
    }
    catch (error) {
        const err = error;
        return res.status(500).json({ error: err.message });
    }
});
// Get user by ID
router.get("/:userId", authMiddleware, async (req, res) => {
    try {
        const userId = getStringParam(req.params.userId);
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                createdAt: true,
                updatedAt: true,
                rooms: {
                    include: {
                        room: true,
                    },
                },
                messages: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                },
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.json(user);
    }
    catch (error) {
        const err = error;
        console.error("Error fetching user:", err);
        return res.status(500).json({ error: err.message });
    }
});
// Upload avatar
router.post("/avatar", authMiddleware, upload.single("avatar"), async (req, res) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        // Generate URL for the uploaded file
        const baseUrl = process.env.BASE_URL || "http://localhost:3001";
        const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
        // Update user in database
        const user = await prisma.user.update({
            where: { id: req.user.userId },
            data: { avatar: avatarUrl },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return res.json({
            message: "Avatar uploaded successfully",
            avatarUrl: user.avatar,
            user,
        });
    }
    catch (error) {
        const err = error;
        console.error("Avatar upload error:", err);
        return res.status(500).json({ error: err.message });
    }
});
// Get user stats
router.get("/:userId/stats", authMiddleware, async (req, res) => {
    try {
        const userId = getStringParam(req.params.userId);
        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        // Get rooms created by user
        const roomsCreated = await prisma.room.count({
            where: { createdById: userId },
        });
        // Get rooms user is a member of
        const roomsJoined = await prisma.roomMember.count({
            where: { userId },
        });
        // Get total messages sent by user
        const totalMessages = await prisma.message.count({
            where: { userId },
        });
        // Get messages per room (optional)
        const messagesByRoom = await prisma.message.groupBy({
            by: ["roomId"],
            where: { userId },
            _count: true,
            orderBy: {
                _count: {
                    roomId: "desc",
                },
            },
            take: 5,
        });
        // Get room names for messagesByRoom
        const messagesByRoomWithNames = await Promise.all(messagesByRoom.map(async (item) => {
            const room = await prisma.room.findUnique({
                where: { id: item.roomId },
                select: { name: true },
            });
            return {
                roomId: item.roomId,
                roomName: room?.name || "Unknown Room",
                count: item._count,
            };
        }));
        // Get recent activity (last 10 messages)
        const recentMessages = await prisma.message.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
                room: {
                    select: { name: true },
                },
            },
        });
        const recentActivity = recentMessages.map((msg) => ({
            type: "message",
            timestamp: msg.createdAt,
            details: `Sent a message in ${msg.room?.name || "a room"}`,
        }));
        return res.json({
            roomsCreated,
            roomsJoined,
            totalMessages,
            messagesByRoom: messagesByRoomWithNames,
            recentActivity,
        });
    }
    catch (error) {
        const err = error;
        console.error("Error fetching user stats:", err);
        return res.status(500).json({ error: err.message });
    }
});
export default router;
//# sourceMappingURL=users.js.map