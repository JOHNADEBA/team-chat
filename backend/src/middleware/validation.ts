import { Request, Response, NextFunction } from "express";

export const validateRoom = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
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

export const validateMessage = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
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
export const validateAddMember = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { userId } = req.body;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "User ID is required" });
  }

  return next();
};
