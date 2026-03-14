import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("❌ JWT_SECRET is not defined in environment variables");
    process.exit(1);
}
export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: "No authorization header" });
        return;
    }
    if (!authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Invalid authorization header format" });
        return;
    }
    const token = authHeader.substring(7);
    if (!token || token.length === 0) {
        res.status(401).json({ error: "No token provided" });
        return;
    }
    try {
        // Verify the token
        const decoded = jwt.verify(token, JWT_SECRET);
        // Check if decoded is a string (shouldn't happen with JWT)
        if (typeof decoded === "string") {
            res.status(401).json({ error: "Invalid token format" });
            return;
        }
        // Create our custom payload
        const payload = {
            userId: decoded.userId || decoded.sub,
            email: decoded.email,
        };
        // Validate payload
        if (!payload.userId) {
            res.status(401).json({ error: "Invalid token payload" });
            return;
        }
        req.user = payload;
        next();
    }
    catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({ error: "Invalid token" });
            return;
        }
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({ error: "Token expired" });
            return;
        }
        res.status(401).json({ error: "Authentication failed" });
        return;
    }
};
//# sourceMappingURL=auth.middleware.js.map