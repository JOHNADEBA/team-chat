import { Request, Response } from "express";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
) => {
  console.error("❌ Error:", err.message);
  console.error("📝 Stack:", err.stack);

  // Check if it's our custom error with statusCode
  const statusCode = (err as any).statusCode || 500;
  
  res.status(statusCode).json({
    error: process.env.NODE_ENV === "production" 
      ? "Internal server error" 
      : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
  });
};