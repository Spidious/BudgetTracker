import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../index';

export interface AuthUser {
  id: string;
  username: string;
  isAdmin: boolean;
  forcePasswordChange: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser & { iat: number; exp: number };
    req.user = {
      id: payload.id,
      username: payload.username,
      isAdmin: payload.isAdmin,
      forcePasswordChange: payload.forcePasswordChange,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}
