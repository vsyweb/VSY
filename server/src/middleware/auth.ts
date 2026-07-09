import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { JwtPayload } from '../types';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: 'user' | 'admin' | 'worker';
    }
  }
}

/**
 * Middleware to authenticate user JWT tokens.
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * Middleware to ensure the user is an admin.
 */
export const adminMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.userRole !== 'admin') {
    res.status(403).json({ success: false, message: 'Admin access required' });
    return;
  }
  next();
};

/**
 * Middleware to ensure the user is an admin or a worker.
 */
export const adminOrWorkerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.userRole !== 'admin' && req.userRole !== 'worker') {
    res.status(403).json({ success: false, message: 'Access denied' });
    return;
  }
  next();
};
