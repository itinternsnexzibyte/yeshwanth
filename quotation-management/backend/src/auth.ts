import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

export type SessionUser = { id: string; name: string; email: string; role: "ADMIN" | "QUOTATION_USER" | "VIEWER" };

declare global {
  namespace Express { interface Request { user?: SessionUser } }
}

export function issueSession(res: Response, user: SessionUser) {
  const token = jwt.sign(user, config.JWT_SECRET, { expiresIn: "8h", issuer: "nexzibyte-quotation" });
  const csrf = randomBytes(24).toString("hex");
  const secure = config.NODE_ENV === "production";
  // Session-only cookies intentionally expire when the browser session closes.
  // There is no persistent "remember me" or automatic-login credential.
  res.cookie("qm_session", token, { httpOnly: true, secure, sameSite: "strict", path: "/" });
  res.cookie("qm_csrf", csrf, { httpOnly: false, secure, sameSite: "strict", path: "/" });
}

export function clearSession(res: Response) {
  res.clearCookie("qm_session", { path: "/" });
  res.clearCookie("qm_csrf", { path: "/" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.qm_session;
  if (!token) return res.status(401).json({ message: "Authentication required" });
  try { req.user = jwt.verify(token, config.JWT_SECRET, { issuer: "nexzibyte-quotation" }) as SessionUser; next(); }
  catch { return res.status(401).json({ message: "Session expired" }); }
}

export function requireRole(...roles: SessionUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: "Insufficient permission" });
    next();
  };
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const cookie = String(req.cookies?.qm_csrf || "");
  const header = String(req.headers["x-csrf-token"] || "");
  if (!cookie || !header || cookie.length !== header.length || !timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }
  next();
}
