import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";
export class AuthController {
    async register(req, res) {
        try {
            const { email, password, name } = req.body;
            // Validate input
            if (!email || !password || !name) {
                return res
                    .status(400)
                    .json({ error: "Email, password, and name are required" });
            }
            if (password.length < 6) {
                return res
                    .status(400)
                    .json({ error: "Password must be at least 6 characters" });
            }
            // Check if user exists
            const existingUser = await prisma.user.findUnique({
                where: { email },
            });
            if (existingUser) {
                return res.status(400).json({ error: "User already exists" });
            }
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);
            // Create user
            const user = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                },
            });
            // Generate JWT
            const payload = { userId: user.id, email: user.email };
            const token = jwt.sign(payload, JWT_SECRET, {
                expiresIn: JWT_EXPIRES_IN,
            });
            // Handle avatar properly for optional property
            const response = {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    ...(user.avatar ? { avatar: user.avatar } : {}),
                },
                token,
            };
            return res.status(201).json(response);
        }
        catch (error) {
            console.error("Registration error:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    async login(req, res) {
        try {
            const { email, password } = req.body;
            // Validate input
            if (!email || !password) {
                return res
                    .status(400)
                    .json({ error: "Email and password are required" });
            }
            // Find user
            const user = await prisma.user.findUnique({
                where: { email },
            });
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }
            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ error: "Invalid password" });
            }
            // Generate JWT
            const payload = { userId: user.id, email: user.email };
            const token = jwt.sign(payload, JWT_SECRET, {
                expiresIn: JWT_EXPIRES_IN,
            });
            // Handle avatar properly for optional property
            const response = {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    ...(user.avatar ? { avatar: user.avatar } : {}),
                },
                token,
            };
            return res.json(response);
        }
        catch (error) {
            console.error("Login error:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
}
//# sourceMappingURL=auth.controller.js.map