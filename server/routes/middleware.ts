/**
 * Authentication and authorization middleware
 */

import type { Request, Response } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import path from "path";
import fs from "fs";
import winston from "winston";
import { storage } from "../storage";

/**
 * Extend express-session with custom data
 */
declare module 'express-session' {
  interface SessionData {
    adminId?: string;
  }
}

/**
 * Security logger for authentication and admin events
 */
export const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'office-map' },
  transports: [
    // Error log file
    new winston.transports.File({ 
      filename: 'logs/security-error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // All security events
    new winston.transports.File({ 
      filename: 'logs/security.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  securityLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
      })
    )
  }));
}

// Ensure logs directory exists
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs', { recursive: true });
}

/**
 * Session configuration and setup
 */
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
    pruneSessionInterval: 60 * 15, // Clean up expired sessions every 15 minutes
    errorLog: console.error,
  });
  
  // SESSION_SECRET validation - REQUIRED for security
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error(
      'CRITICAL: SESSION_SECRET environment variable is required and must be a strong random string. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      // set secure flag automatically when local certs exist
      secure: (function () {
        try {
          const crtDir = path.resolve(__dirname, '..', 'crt');
          const pfxPath = path.join(crtDir, 'map.spectrum.int.pfx');
          const keyPath = path.join(crtDir, 'map.spectrum.int.key');
          const certPath = path.join(crtDir, 'map.spectrum.int.crt');
          if (fs.existsSync(pfxPath)) return true;
          if (fs.existsSync(keyPath) && fs.existsSync(certPath)) return true;
        } catch (e) {
          /* ignore */
        }
        return false;
      })(),
      maxAge: sessionTtl,
    },
  });
}

/**
 * Authentication middleware - verifies session exists
 */
export function requireAuth(req: Request, res: Response, next: Function) {
  if (req.session?.adminId) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(roles: Array<'admin' | 'hr'>) {
  return async function (req: Request, res: Response, next: Function) {
    try {
      if (!req.session?.adminId) return res.status(401).json({ message: "Unauthorized" });
      const admin = await storage.getAdminById(req.session.adminId);
      if (!admin) return res.status(401).json({ message: "Unauthorized" });
      if (!('role' in admin)) return res.status(403).json({ message: "Forbidden" });
      if (!roles.includes((admin as any).role)) return res.status(403).json({ message: "Forbidden" });
      next();
    } catch (e) {
      res.status(500).json({ message: "Internal server error" });
    }
  }
}
