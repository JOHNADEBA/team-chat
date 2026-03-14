export const validateRoom = (req, res, next) => {
    const { name } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Room name is required" });
    }
    if (name.length > 50) {
        return res.status(400).json({ error: "Room name too long (max 50 chars)" });
    }
    // If validation passes, call next() and return
    return next();
};
export const validateMessage = (req, res, next) => {
    const { content } = req.body;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ error: "Message content is required" });
    }
    if (content.length > 1000) {
        return res.status(400).json({ error: "Message too long (max 1000 chars)" });
    }
    return next();
};
// Optional: Add validation for adding members
export const validateAddMember = (req, res, next) => {
    const { userId } = req.body;
    if (!userId || typeof userId !== "string") {
        return res.status(400).json({ error: "User ID is required" });
    }
    return next();
};
//# sourceMappingURL=validation.js.map