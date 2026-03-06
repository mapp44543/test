// Транслитерация кириллицы в латиницу для кода этажа
function translit(str: string) {
  const map: Record<string, string> = {
    А:'A',Б:'B',В:'V',Г:'G',Д:'D',Е:'E',Ё:'E',Ж:'Zh',З:'Z',И:'I',Й:'Y',К:'K',Л:'L',М:'M',Н:'N',О:'O',П:'P',Р:'R',С:'S',Т:'T',У:'U',Ф:'F',Х:'Kh',Ц:'Ts',Ч:'Ch',Ш:'Sh',Щ:'Sch',Ъ:'',Ы:'Y',Ь:'',Э:'E',Ю:'Yu',Я:'Ya',
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
  };
  return str.split('').map(c => map[c] || c).join('');
}

// Escape LDAP filter special characters to prevent LDAP injection attacks (RFC 4515)
function escapeLdapFilter(value: string): string {
  if (!value) return '';
  return value
    .replace(/\\/g, '\\5c') // backslash
    .replace(/\*/g, '\\2a') // asterisk
    .replace(/\(/g, '\\28') // left paren
    .replace(/\)/g, '\\29') // right paren
    .replace(/\x00/g, '\\00'); // null byte
}
import type { Express, Request, Response } from "express";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createHttpServer, type Server } from "http";
import https from "https";
import { WebSocketServer, WebSocket } from "ws";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcrypt";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import winston from "winston";
import { storage } from "./storage";
import { 
  insertLocationSchema, 
  updateLocationSchema, 
  insertAdminSchema, 
  insertFloorSchema,
  insertMarkerSchema,
  updateMarkerSchema,
  insertAvatarSchema,
  updateAvatarSchema,
  insertPublicLinkSchema,
  updatePublicLinkSchema 
} from "@shared/schema";
import { z } from "zod";
import ldap from "ldapjs";
import { spawnSync, spawn } from "child_process";
import { adSyncScheduler } from "./ad-sync-scheduler";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { socketPortScheduler } from "./socket-port-scheduler";
import { fetchCiscoPortInfo } from "./cisco-port-status";

// Security logger for authentication and admin events
const securityLogger = winston.createLogger({
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

// Session configuration
function getSession() {
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

// Extend session type
declare module 'express-session' {
  interface SessionData {
    adminId?: string;
  }
}

// Authentication middleware
function requireAuth(req: Request, res: Response, next: Function) {
  if (req.session?.adminId) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
}

// Role-based guard
function requireRole(roles: Array<'admin' | 'hr'>) {
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Security middleware - MUST be applied before other routes
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://replit.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        objectSrc: ["'self'"],
        connectSrc: ["'self'", "wss:", "ws:", "https://fonts.gstatic.com"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  // CORS configuration
  const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
  };
  app.use(cors(corsOptions));
  // Session middleware (moved before rate limiting so limiter can inspect session)
  app.use(getSession());

  // Rate limiting for general API (excluding status/read-only endpoints)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Don't rate limit authenticated administrators
      try {
        // `req.session` is available because session middleware is applied earlier
        if ((req as any).session?.adminId) return true;
      } catch (e) {
        /* ignore */
      }

      // Don't rate limit GET requests for status/data endpoints
      if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
        // Only apply rate limiting to mutation operations, not reads
        return true;
      }
      // Also specifically exclude critical endpoints
      return req.path === '/api/admin/me' || req.path === '/api/capabilities';
    }
  });
  app.use('/api/', limiter);

  // Rate limiting for login - stricter
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    message: 'Too many login attempts from this IP, please try again later',
  });

  // Роут для получения статуса порта Cisco
  const { getCiscoPortStatus } = await import('./cisco-port-status');
  app.get('/api/cisco-port-status', getCiscoPortStatus);

  // (session middleware moved earlier)

  // Serve floor plan images from server/public/floor-plans in all environments
  const floorPlansDir = path.resolve(__dirname, "public", "floor-plans");
  fs.mkdirSync(floorPlansDir, { recursive: true });
  app.use("/floor-plans", express.static(floorPlansDir));

  // WebSocket clients storage
  const wsClients = new Set<WebSocket>();

  // Broadcast function - safe for Windows compatibility when WebSocket is disabled
  function broadcast(data: any) {
    if (wsClients.size === 0) {
      // WebSocket is disabled or no clients connected - this is normal on Windows
      return;
    }
    
    let message: string;
    try {
      message = JSON.stringify(data);
    } catch (e) {
      console.error('Failed to stringify broadcast data:', e);
      return;
    }

    wsClients.forEach(client => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      } catch (error) {
        wsClients.delete(client);
      }
    });
  }

  // Validation schema for password reset
  const passwordResetSchema = z.object({
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must not exceed 50 characters')
      .regex(/^[a-zA-Z0-9._-]+$/, 'Username contains invalid characters'),
    newPassword: z.string()
      .min(12, 'Password must be at least 12 characters')
      .max(128, 'Password must not exceed 128 characters')
      .regex(/[A-Z]/, 'Password must contain uppercase letters')
      .regex(/[a-z]/, 'Password must contain lowercase letters')
      .regex(/[0-9]/, 'Password must contain numbers')
      .regex(/[^a-zA-Z0-9]/, 'Password must contain special characters'),
    token: z.string().min(32, 'Invalid token'),
  });

  // Admin reset route (only enabled when ADMIN_RESET_TOKEN is set)
  app.post("/api/admin/reset", async (req, res) => {
    try {
      if (!process.env.ADMIN_RESET_TOKEN) {
        return res.status(404).json({ message: "Not found" });
      }

      // Validate input with schema
      let validatedData;
      try {
        validatedData = passwordResetSchema.parse(req.body);
      } catch (validationError) {
        return res.status(400).json({ message: "Invalid input", error: validationError });
      }

      const { username, newPassword, token } = validatedData;

      if (token !== process.env.ADMIN_RESET_TOKEN) {
        return res.status(401).json({ message: "Invalid token" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      const admin = await storage.updateAdminPassword(username, hashedPassword);
      
      if (!admin) {
        return res.status(404).json({ message: "Admin not found" });
      }

      res.json({ success: true, message: "Password reset successful" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Validation schema for login
  const loginSchema = z.object({
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must not exceed 50 characters'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must not exceed 128 characters'),
  });

  // Auth routes
  app.post("/api/admin/login", loginLimiter, async (req, res) => {
    try {
      // Validate input with schema
      let validatedData;
      try {
        validatedData = loginSchema.parse(req.body);
      } catch (validationError) {
        securityLogger.warn('Login validation failed', {
          ip: req.ip,
          userAgent: req.get('user-agent')
        });
        return res.status(400).json({ message: "Invalid input", error: validationError });
      }

      const { username, password } = validatedData;

      const admin = await storage.getAdminByUsername(username);
      if (!admin) {
        securityLogger.warn('Login failed: user not found', {
          username,
          ip: req.ip,
          userAgent: req.get('user-agent')
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, admin.password);
      if (!isValid) {
        securityLogger.warn('Login failed: invalid password', {
          username,
          ip: req.ip,
          userAgent: req.get('user-agent')
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      securityLogger.info('Login successful', {
        adminId: admin.id,
        username: admin.username,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      req.session.adminId = admin.id;
      res.json({ success: true, admin: { id: admin.id, username: admin.username, role: (admin as any).role || 'admin' } });
    } catch (error) {
      securityLogger.error('Login error', {
        error: String(error),
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ success: true });
    });
  });

  // Return current admin session info. For unauthenticated users return 200 with admin: null
  // This prevents noisy 401 errors in browser console for public users while allowing
  // client to clearly detect authenticated state from the response body.
  app.get("/api/admin/me", async (req, res) => {
    try {
      if (!req.session?.adminId) {
        return res.json({ admin: null });
      }
      const admin = await storage.getAdminById(req.session.adminId!);
      if (!admin) {
        // Session references a non-existing admin: clear session and return null
        try { req.session.adminId = undefined; } catch (e) { /* ignore */ }
        return res.json({ admin: null });
      }
      res.json({ admin: { id: admin.id, username: admin.username, role: (admin as any).role || 'admin' } });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // AD Sync status endpoint - get current scheduler status
  app.get("/api/admin/ad-sync/status", requireAuth, async (req, res) => {
    try {
      const status = adSyncScheduler.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to get AD Sync status" });
    }
  });

  // AD Sync control endpoint - manually trigger synchronization
  app.post("/api/admin/ad-sync/trigger", requireAuth, async (req, res) => {
    try {
      // Check if sync is already running
      const currentStatus = adSyncScheduler.getStatus();
      if (currentStatus.isRunning) {
        return res.status(409).json({ 
          message: "AD Sync is already running",
          status: currentStatus
        });
      }

      // Trigger the sync (this happens asynchronously)
      adSyncScheduler.executeSync().catch((error) => {
        securityLogger.error(`Manual AD Sync failed: ${error instanceof Error ? error.message : String(error)}`);
      });
      
      // Return immediately with the triggered status
      // Client will poll for updates via /api/admin/ad-sync/status
      const updatedStatus = adSyncScheduler.getStatus();
      
      res.json({ 
        success: true, 
        message: "AD Sync triggered",
        status: updatedStatus
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to trigger AD Sync",
        error: String(error)
      });
    }
  });

  // Location routes (public read access)
  app.get("/api/locations", async (req, res) => {
    try {
      const { floor } = req.query;
      let locations;
      
      if (floor && typeof floor === 'string') {
        locations = await storage.getLocationsByFloor(floor);
      } else {
        locations = await storage.getAllLocations();
      }
      
      res.json(locations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  app.get("/api/locations/:id", async (req, res) => {
    try {
      const location = await storage.getLocation(req.params.id);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch location" });
    }
  });

  // Floor routes (public list)
  app.get("/api/floors", async (_req, res) => {
    try {
      const floors = await storage.getFloors();
      res.json(floors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch floors" });
    }
  });

  // Admin-only floors CRUD
  app.post("/api/admin/floors", requireRole(['admin']), async (req, res) => {
    try {
      const validated = insertFloorSchema.parse(req.body);
      const created = await storage.createFloor(validated);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create floor" });
    }
  });

  app.put("/api/admin/floors/:id", requireRole(['admin']), async (req, res) => {
    try {
      const validated = insertFloorSchema.partial().parse(req.body);
      const updated = await storage.updateFloor(req.params.id, validated);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update floor" });
    }
  });

  // Update only sort order for a floor (used by admin UI when reordering floors)
  app.put("/api/admin/floors/:id/order", requireRole(['admin']), async (req, res) => {
    try {
      const bodySchema = z.object({ sortOrder: z.number() });
      const { sortOrder } = bodySchema.parse(req.body);
      const updated = await storage.updateFloor(req.params.id, { sortOrder });
      // notify connected clients that floors order changed
      try { broadcast({ type: 'FLOORS_ORDER_UPDATED' }); } catch (e) { /* ignore broadcast errors */ }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update floor order" });
    }
  });

  // Bulk update floor order (accepts { ids: string[] } with desired order)
  app.put("/api/admin/floors/order", requireRole(['admin']), async (req, res) => {
    try {
      const bodySchema = z.object({ ids: z.array(z.string()).min(1) });
      const { ids } = bodySchema.parse(req.body);
      await storage.updateFloorsOrder(ids);
      // Broadcast updated order to clients
      try { broadcast({ type: 'FLOORS_ORDER_UPDATED', ids }); } catch (e) { /* ignore */ }
      const floorsList = await storage.getFloors();
      res.json({ success: true, floors: floorsList });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update floors order" });
    }
  });

  app.delete("/api/admin/floors/:id", requireRole(['admin']), async (req, res) => {
    try {
      await storage.deleteFloor(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete floor" });
    }
  });

  // Upload/replace floor plan image (expects { imageBase64: string, filename?: string })
  app.post("/api/admin/floors/:id/image", requireAuth, async (req, res) => {
    try {
      const bodySchema = z.object({ imageBase64: z.string().min(10), filename: z.string().optional() });
      const { imageBase64, filename } = bodySchema.parse(req.body);

      // Find floor to derive file name by code
      const floorsList = await storage.getFloors();
      const floor = floorsList.find(f => f.id === req.params.id);
      if (!floor) {
        return res.status(404).json({ message: "Floor not found" });
      }

      // Determine the file type and extension
      let ext = "png";
      let mimeType = "image/png";
      
      // Check if it's a data URL or just base64
      const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,/);
      if (dataUrlMatch) {
        mimeType = dataUrlMatch[1];
        if (mimeType.includes("svg")) {
          ext = "svg";
        } else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
          ext = "jpg";
        } else if (mimeType.includes("png")) {
          ext = "png";
        }
      } else if (filename) {
        // Try to infer from filename
        const nameExt = filename.split(".").pop()?.toLowerCase();
        if (nameExt === "svg") {
          ext = "svg";
          mimeType = "image/svg+xml";
        } else if (nameExt === "jpg" || nameExt === "jpeg") {
          ext = "jpg";
          mimeType = "image/jpeg";
        } else if (nameExt === "png") {
          ext = "png";
          mimeType = "image/png";
        }
      }

      // Validate supported formats
      const supportedFormats = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
      if (!supportedFormats.includes(mimeType)) {
        return res.status(400).json({ message: `Unsupported format: ${mimeType}. Supported: PNG, JPEG, SVG` });
      }

      const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, "");
      const safeCode = translit(floor.code).replace(/[^a-zA-Z0-9-_]/g, "_");
      const fileName = `${safeCode}.${ext}`;
      const filePath = path.join(floorPlansDir, fileName);

      await fs.promises.writeFile(filePath, Buffer.from(base64Data, "base64"));

      // Add cache-busting timestamp to the URL to force browser to fetch latest image
      const publicUrl = `/floor-plans/${fileName}?t=${Date.now()}`;
      const updated = await storage.updateFloor(floor.id, { imageUrl: publicUrl, mimeType });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Admin-only location management
  app.post("/api/admin/locations", requireRole(['admin']), async (req, res) => {
    try {
      const validatedData = insertLocationSchema.parse(req.body);
      // If creating a socket location, require port and verify it via Cisco sync

      const location = await storage.createLocation(validatedData);
      
      // Broadcast update to all connected clients
      broadcast({ type: "LOCATION_CREATED", location });

      // If socket — run async cisco-sync to enrich customFields (non-blocking)
      if (validatedData.type === 'socket') {
        // Run internal async Cisco fetch (non-blocking) to enrich customFields
        (async () => {
          try {
            const cfLoc = (location.customFields && typeof location.customFields === 'object') ? (location.customFields as Record<string, any>) : {};
            const portRaw = cfLoc.port || cfLoc.Port || location.name || '';
            const portArg = String(portRaw).split('/').pop()?.replace(/\D/g,'') || '';
            if (!portArg) return;

            try {
              const ciscoSite = cfLoc.ciscoSite || location.floor || '5';
              const parsed = await fetchCiscoPortInfo(portArg, ciscoSite);
              const nowIso = new Date().toISOString();
              const updatedCF = { ...(location.customFields as Record<string, any> || {}) };

              const portVal = parsed.Port || parsed.port || '';
              if (portVal) { updatedCF.port = portVal; updatedCF.Port = portVal; }

              const nameVal = parsed.Name || parsed.name || '';
              if (nameVal) { updatedCF.Name = nameVal; updatedCF.name = nameVal; }

              const statusVal = parsed.Status || parsed.status || '';
              if (statusVal) {
                updatedCF.Status = statusVal; updatedCF.status = statusVal; updatedCF.ciscoStatus = statusVal; updatedCF.CiscoStatus = statusVal;
              }

              const vlanVal = parsed.Vlan || parsed.vlan || '';
              if (vlanVal) { updatedCF.Vlan = vlanVal; updatedCF.vlan = vlanVal; }

              const duplexVal = parsed.Duplex || parsed.duplex || '';
              if (duplexVal) { updatedCF.Duplex = duplexVal; updatedCF.duplex = duplexVal; }

              const speedVal = parsed.Speed || parsed.speed || '';
              if (speedVal) { updatedCF.Speed = speedVal; updatedCF.speed = speedVal; }

              const typeVal = parsed.Type || parsed.type || '';
              if (typeVal) { updatedCF.Type = typeVal; updatedCF.type = typeVal; }

              updatedCF.StatusLastSync = nowIso;

              await storage.updateLocation({ id: location.id, customFields: updatedCF } as any);
              try { 
                const updated = await storage.getLocation(location.id);
                if (updated) {
                  broadcast({ type: 'LOCATION_UPDATED', location: updated }); 
                }
              } catch (e) { /* ignore */ }
            } catch (err) {
              // Log cisco sync errors for debugging
              console.error('Cisco sync error for location ' + location.id + ':', err);
            }
          } catch (e) {
            // Log async cisco-sync errors for debugging
            console.error('Async cisco-sync error:', e);
          }
        })();
      }

      res.status(201).json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  app.put("/api/admin/locations/:id", requireRole(['admin','hr']), async (req, res) => {
    try {
      const validatedData = updateLocationSchema.parse({ id: req.params.id, ...req.body });

      const location = await storage.updateLocation(validatedData);
      
      // Broadcast update to all connected clients
      broadcast({ type: "LOCATION_UPDATED", location });

      // If socket — run async cisco-sync to enrich customFields (non-blocking)
      if (validatedData.type === 'socket') {
        // Run internal async Cisco fetch (non-blocking) to enrich customFields
        (async () => {
          try {
            const cfLoc = (location.customFields && typeof location.customFields === 'object') ? (location.customFields as Record<string, any>) : {};
            const portRaw = cfLoc.port || cfLoc.Port || location.name || '';
            const portArg = String(portRaw).split('/').pop()?.replace(/\D/g,'') || '';
            if (!portArg) return;

            try {
              const ciscoSite = cfLoc.ciscoSite || location.floor || '5';
              const parsed = await fetchCiscoPortInfo(portArg, ciscoSite);
              const nowIso = new Date().toISOString();
              const updatedCF = { ...(location.customFields as Record<string, any> || {}) };

              const portVal = parsed.Port || parsed.port || '';
              if (portVal) { updatedCF.port = portVal; updatedCF.Port = portVal; }

              const nameVal = parsed.Name || parsed.name || '';
              if (nameVal) { updatedCF.Name = nameVal; updatedCF.name = nameVal; }

              const statusVal = parsed.Status || parsed.status || '';
              if (statusVal) {
                updatedCF.Status = statusVal; updatedCF.status = statusVal; updatedCF.ciscoStatus = statusVal; updatedCF.CiscoStatus = statusVal;
              }

              const vlanVal = parsed.Vlan || parsed.vlan || '';
              if (vlanVal) { updatedCF.Vlan = vlanVal; updatedCF.vlan = vlanVal; }

              const duplexVal = parsed.Duplex || parsed.duplex || '';
              if (duplexVal) { updatedCF.Duplex = duplexVal; updatedCF.duplex = duplexVal; }

              const speedVal = parsed.Speed || parsed.speed || '';
              if (speedVal) { updatedCF.Speed = speedVal; updatedCF.speed = speedVal; }

              const typeVal = parsed.Type || parsed.type || '';
              if (typeVal) { updatedCF.Type = typeVal; updatedCF.type = typeVal; }

              updatedCF.StatusLastSync = nowIso;

              await storage.updateLocation({ id: location.id, customFields: updatedCF } as any);
              try { 
                const updated = await storage.getLocation(location.id);
                if (updated) {
                  broadcast({ type: 'LOCATION_UPDATED', location: updated }); 
                }
              } catch (e) { /* ignore */ }
            } catch (err) {
              // Log cisco sync errors for debugging
              console.error('Cisco sync error for location ' + location.id + ':', err);
            }
          } catch (e) {
            // Log async cisco-sync errors for debugging
            console.error('Async cisco-sync error:', e);
          }
        })();
      }

      res.json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  app.delete("/api/admin/locations/:id", requireRole(['admin']), async (req, res) => {
    try {
      // Сначала удаляем все маркеры для локации
      await storage.deleteMarkersByLocation(req.params.id);
      // Затем удаляем саму локацию
      await storage.deleteLocation(req.params.id);
      
      // Broadcast update to all connected clients
      broadcast({ type: "LOCATION_DELETED", id: req.params.id });
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete location" });
    }
  });

  // Marker endpoints
  app.get("/api/locations/:locationId/markers", async (req, res) => {
    try {
      const markers = await storage.getMarkersByLocation(req.params.locationId);
      res.json(markers);
    } catch (error) {
      res.status(500).json({ message: "Failed to get markers" });
    }
  });

  app.get("/api/locations/:locationId/markers/:key", async (req, res) => {
    try {
      const marker = await storage.getMarker(req.params.locationId, req.params.key);
      if (!marker) {
        return res.status(404).json({ message: "Marker not found" });
      }
      res.json(marker);
    } catch (error) {
      res.status(500).json({ message: "Failed to get marker" });
    }
  });

  app.post("/api/admin/locations/:locationId/markers", requireRole(['admin']), async (req, res) => {
    try {
      const validatedData = insertMarkerSchema.parse({ 
        ...req.body, 
        locationId: req.params.locationId 
      });
      const marker = await storage.createMarker(validatedData);
      
      // Broadcast update
      const location = await storage.getLocation(req.params.locationId);
      if (location) {
        broadcast({ type: "LOCATION_UPDATED", location });
      }
      
      res.status(201).json(marker);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create marker" });
    }
  });

  // Cisco sync endpoint for a location: run cisco-sync.py based on stored port


  // Background periodic sync for socket locations with interval batching
  // Run periodic Cisco sync for all socket locations. Ports are grouped in batches (1-10, 11-20, etc.)
  // and each batch is processed at 30-minute intervals
  (function setupBackgroundCiscoSync() {
    // Background CISCO sync is enabled for socket types
    // Scheduler will start automatically during server initialization
  })();


  app.put("/api/admin/markers/:id", requireRole(['admin']), async (req, res) => {
    try {
      const validatedData = updateMarkerSchema.parse({ 
        id: req.params.id,
        ...req.body 
      });
      const marker = await storage.updateMarker(validatedData);
      
      // Broadcast update
      const location = await storage.getLocation(marker.locationId);
      if (location) {
        broadcast({ type: "LOCATION_UPDATED", location });
      }
      
      res.json(marker);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update marker" });
    }
  });

  app.delete("/api/admin/markers/:id", requireRole(['admin']), async (req, res) => {
    try {
      // Сначала получим маркер чтобы знать его locationId
      const marker = await storage.getMarker(req.params.id);
      if (!marker) {
        return res.status(404).json({ message: "Marker not found" });
      }
      
      await storage.deleteMarker(req.params.id);
      
      // Broadcast update
      const location = await storage.getLocation(marker.locationId);
      if (location) {
        broadcast({ type: "LOCATION_UPDATED", location });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete marker" });
    }
  });

  // Avatar endpoints
  app.get("/api/locations/:locationId/avatar", async (req, res) => {
    try {
      const avatar = await storage.getAvatarByLocation(req.params.locationId);
      if (!avatar) {
        // Return 200 with null instead of 404 to avoid noisy errors in browser console
        return res.json({ avatar: null });
      }
      res.json(avatar);
    } catch (error) {
      res.status(500).json({ message: "Failed to get avatar" });
    }
  });

  app.post("/api/admin/locations/:locationId/avatar", requireRole(['admin']), async (req, res) => {
    try {
      // Проверяем, есть ли уже аватар для этой локации
      const existingAvatar = await storage.getAvatarByLocation(req.params.locationId);
      if (existingAvatar) {
        // Если есть - удаляем
        await storage.deleteAvatar(existingAvatar.id);
      }

      const validatedData = insertAvatarSchema.parse({ 
        ...req.body, 
        locationId: req.params.locationId 
      });
      
      const avatar = await storage.createAvatar(validatedData);
      
      // Broadcast update
      const location = await storage.getLocation(req.params.locationId);
      if (location) {
        broadcast({ type: "LOCATION_UPDATED", location });
      }
      
      res.status(201).json(avatar);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create avatar" });
    }
  });

  app.put("/api/admin/avatars/:id", requireRole(['admin']), async (req, res) => {
    try {
      const validatedData = updateAvatarSchema.parse({ 
        id: req.params.id,
        ...req.body 
      });
      const avatar = await storage.updateAvatar(validatedData);
      
      // Broadcast update
      const location = await storage.getLocation(avatar.locationId);
      if (location) {
        broadcast({ type: "LOCATION_UPDATED", location });
      }
      
      res.json(avatar);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update avatar" });
    }
  });

  app.delete("/api/admin/avatars/:id", requireRole(['admin']), async (req, res) => {
    try {
      // Сначала получим аватар чтобы знать его locationId
      const avatar = await storage.getAvatar(req.params.id);
      if (!avatar) {
        return res.status(404).json({ message: "Avatar not found" });
      }
      
      await storage.deleteAvatar(req.params.id);
      
      // Broadcast update
      const location = await storage.getLocation(avatar.locationId);
      if (location) {
        broadcast({ type: "LOCATION_UPDATED", location });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete avatar" });
    }
  });

  // Public links endpoints
  app.get("/api/public-links", async (_req, res) => {
    try {
      const links = await storage.getPublicLinks();
      res.json(links);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch public links" });
    }
  });

  app.post("/api/admin/public-links", requireRole(['admin']), async (req, res) => {
    try {
      const validatedData = insertPublicLinkSchema.parse(req.body);
      const link = await storage.createPublicLink(validatedData);
      res.status(201).json(link);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create public link" });
    }
  });

  app.put("/api/admin/public-links/:id", requireRole(['admin']), async (req, res) => {
    try {
      const validatedData = updatePublicLinkSchema.parse({ 
        id: req.params.id,
        ...req.body 
      });
      const link = await storage.updatePublicLink(validatedData);
      res.json(link);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update public link" });
    }
  });

  app.delete("/api/admin/public-links/:id", requireRole(['admin']), async (req, res) => {
    try {
      await storage.deletePublicLink(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete public link" });
    }
  });

  // Serve icons directory
  const iconsDir = path.resolve(__dirname, "..", "public", "icons");
  fs.mkdirSync(iconsDir, { recursive: true });
  app.use("/icons", express.static(iconsDir));

  // Get available SVG icons for a category (e.g., /api/icons/Общая%20зона)
  app.get("/api/icons/:category", async (req, res) => {
    try {
      const category = decodeURIComponent(req.params.category);
      const categoryPath = path.join(iconsDir, category);
      
      // Security: ensure the path is within iconsDir
      if (!path.resolve(categoryPath).startsWith(path.resolve(iconsDir))) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!fs.existsSync(categoryPath)) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.json({ icons: [] });
      }

      const files = await fs.promises.readdir(categoryPath);
      const svgFiles = files.filter(f => f.toLowerCase().endsWith('.svg'));
      
      // Prevent browser caching for icons list so updates are immediate
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      res.json({ 
        icons: svgFiles.map(name => ({
          name,
          url: `/icons/${category}/${name}`
        }))
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch icons" });
    }
  });

  // API capabilities endpoint
  app.get("/api/capabilities", (req, res) => {
    const websocketsEnabled = process.env.WEBSOCKETS_ENABLED !== 'false';
    res.json({
      websockets: websocketsEnabled,
      features: {
        realTimeUpdates: websocketsEnabled
      }
    });
  });

  // LDAP lookup for AD users (admin-only)
  app.get("/api/admin/ldap-user", requireRole(['admin']), async (req, res) => {
    try {
      const login = String(req.query.login || "").trim();
      if (!login) return res.status(400).json({ message: "login required" });

      const LDAP_URL = process.env.LDAP_URL;
      const BIND_DN = process.env.LDAP_BIND_DN;
      const BIND_PASSWORD = process.env.LDAP_BIND_PASSWORD;
      const BASE_DN = process.env.LDAP_BASE_DN;

      if (!LDAP_URL || !BIND_DN || !BIND_PASSWORD || !BASE_DN) {
        return res.status(500).json({ message: 'LDAP is not configured on server' });
      }

      const client = ldap.createClient({ url: LDAP_URL });

      // prevent unhandled client errors (e.g., ECONNRESET on LDAPS)
      let clientErrored = false;
      const onClientError = (err: any) => {
        clientErrored = true;
      };
      client.on('error', onClientError);

      // build bind candidates: original BIND_DN, sAMAccountName (first RDN), and UPN (user@domain from BASE_DN)
      const candidates: string[] = [];
      if (BIND_DN) candidates.push(BIND_DN);
      let rdnName: string | null = null;
      try {
        if (BIND_DN && BIND_DN.includes(',')) {
          const first = BIND_DN.split(',')[0];
          if (first.includes('=')) rdnName = first.split('=')[1];
        }
      } catch (e) {
        /* ignore */
      }
      if (rdnName) candidates.push(rdnName);

      // derive domain from BASE_DN -> dc1.dc2
      let domain: string | null = null;
      try {
        if (BASE_DN) {
          const parts = BASE_DN.split(',').map(p => p.trim()).filter(p => p.toUpperCase().startsWith('DC='));
          domain = parts.map(p => p.split('=')[1]).join('.');
        }
      } catch (e) { domain = null; }
      if (rdnName && domain) candidates.push(`${rdnName}@${domain}`);

      // attempt bind using candidates in sequence
      let bound = false;
      let lastBindError: any = null;
      for (const bindStr of candidates) {
        if (!bindStr) continue;
        try {
          await new Promise<void>((resolve, reject) => {
            let called = false;
            client.bind(bindStr, BIND_PASSWORD, (err: Error | null) => {
              if (called) return;
              called = true;
              if (err) return reject(err);
              resolve();
            });
            // timeout safety
            setTimeout(() => { if (!called) { called = true; reject(new Error('LDAP bind timeout')); } }, 5000);
          });
          bound = true;
          // keep the client bound for search
          break;
        } catch (err) {
          lastBindError = err;
          // try next candidate
        }
      }

      if (!bound) {
        client.removeListener('error', onClientError);
        try { client.unbind(); } catch (e) {}
        securityLogger.warn('LDAP bind failed', {
          login,
          error: String(lastBindError),
          adminId: req.session?.adminId,
          ip: req.ip,
          userAgent: req.get('user-agent')
        });
        return res.status(500).json({ message: 'LDAP bind failed', details: String(lastBindError) });
      }

      // escape LDAP filter special chars
      const q = escapeLdapFilter(login);
      // search by multiple attributes: sAMAccountName, userPrincipalName, cn, mail
      const opts = {
        filter: `(|(sAMAccountName=${q})(userPrincipalName=${q})(cn=${q})(mail=${q}))`,
        scope: 'sub' as const,
        // request all user attributes to be robust against various AD schemas
        attributes: ['*']
      };

      client.search(BASE_DN, opts, (err: Error | null, ldapRes: any) => {
        if (err) {
          client.removeListener('error', onClientError);
          client.unbind();
          return res.status(500).json({ message: 'LDAP search error', details: String(err) });
        }

        let user: any = null;
        ldapRes.on('searchEntry', (entry: any) => {
          // ldapjs usually exposes entry.object, but some responses may not populate it.
          // Build a plain object from entry.attributes as a fallback.
          try {
            if (entry && entry.object && Object.keys(entry.object).length) {
              user = entry.object;
              return;
            }
          } catch (e) {}

          if (entry && Array.isArray(entry.attributes) && entry.attributes.length) {
            const obj: Record<string, any> = {};
            for (const attr of entry.attributes) {
              try {
                const vals = (attr && (attr.values || attr.vals || attr._vals)) || attr;
                // choose single value if array of length 1
                if (Array.isArray(vals) && vals.length === 1) obj[attr.type || attr.typeName || attr.attribute] = vals[0];
                else obj[attr.type || attr.typeName || attr.attribute] = vals;
              } catch (e) {
                // best-effort
                obj[attr.type || attr.typeName || attr.attribute] = attr;
              }
            }
            user = obj;
            return;
          }

          try {
            import('node:util').then((util) => {
              // Log entry for debugging if needed
            }).catch(() => {});
          } catch (e) {
            // ignore
          }

          // last resort: try toJSON or toObject methods
          try {
            if (entry && typeof entry.toObject === 'function') {
              user = entry.toObject();
            } else if (entry && typeof entry.toJSON === 'function') {
              user = entry.toJSON();
            }
          } catch (e) {
            // ignore
          }
        });

        ldapRes.on('error', (err: any) => {
          client.removeListener('error', onClientError);
          client.unbind();
          console.error('LDAP response error', err);
          return res.status(500).json({ message: 'LDAP response error', details: String(err) });
        });

        ldapRes.on('end', () => {
          client.removeListener('error', onClientError);
          client.unbind();
          if (user) {
            return res.json(user);
          }
          return res.status(404).json({ message: 'User not found' });
        });
      });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post("/api/admin/sync-ad", requireRole(['admin']), async (_req, res) => {
    try {
      const LDAP_URL = process.env.LDAP_URL;
      const BIND_DN = process.env.LDAP_BIND_DN;
      const BIND_PASSWORD = process.env.LDAP_BIND_PASSWORD;
      const BASE_DN = process.env.LDAP_BASE_DN;

      const ldapConfigured = Boolean(LDAP_URL && BIND_DN && BIND_PASSWORD && BASE_DN);
      if (!ldapConfigured) {
        return res.status(500).json({ message: 'LDAP не настроен на сервере' });
      }

      // Collect all locations with an 'employee' marker (treat as AD login)
      const all = await storage.getAllLocations();
      const workLocations = all.filter((l) => (l.type === 'workstation' || !l.type) && l.id);

      const results: Array<{ id: string; login?: string; status: 'updated' | 'skipped' | 'not_found' | 'error'; reason?: string }> = [];

      // Initialize single LDAP client and bind like in ldap-user endpoint (robust bind attempts)
      const client = ldap.createClient({ url: LDAP_URL! });
      let clientErrored = false;
      const onClientError = (err: any) => { clientErrored = true; };
      client.on('error', onClientError);

      // build bind candidates: original BIND_DN, sAMAccountName (first RDN), and UPN (user@domain from BASE_DN)
      const candidates: string[] = [];
      if (BIND_DN) candidates.push(BIND_DN);
      let rdnName: string | null = null;
      try {
        if (BIND_DN && BIND_DN.includes(',')) {
          const first = BIND_DN.split(',')[0];
          if (first.includes('=')) rdnName = first.split('=')[1];
        }
      } catch (e) { /* ignore */ }
      if (rdnName) candidates.push(rdnName);
      let domain: string | null = null;
      try {
        if (BASE_DN) {
          const parts = BASE_DN.split(',').map(p => p.trim()).filter(p => p.toUpperCase().startsWith('DC='));
          domain = parts.map(p => p.split('=')[1]).join('.');
        }
      } catch (e) { domain = null; }
      if (rdnName && domain) candidates.push(`${rdnName}@${domain}`);

      let bound = false;
      let lastBindError: any = null;
      for (const bindStr of candidates) {
        if (!bindStr) continue;
        try {
          await new Promise<void>((resolve, reject) => {
            let called = false;
            client.bind(bindStr, BIND_PASSWORD!, (err: Error | null) => {
              if (called) return; called = true; err ? reject(err) : resolve();
            });
            setTimeout(() => { if (!called) { called = true; reject(new Error('LDAP bind timeout')); } }, 5000);
          });
          bound = true;
          break;
        } catch (err) {
          lastBindError = err;
        }
      }

      if (!bound) {
        client.removeListener('error', onClientError);
        try { client.unbind(); } catch (e) {}
        securityLogger.warn('LDAP bind failed in users-sync endpoint', {
          error: String(lastBindError),
          adminId: _req.session?.adminId,
          ip: _req.ip,
          userAgent: _req.get('user-agent')
        });
        return res.status(500).json({ message: 'LDAP bind failed', details: String(lastBindError) });
      }

      const searchByLogin = (login: string) => new Promise<any>((resolve, reject) => {
        const q = escapeLdapFilter(login);
        const opts = { filter: `(|(sAMAccountName=${q})(userPrincipalName=${q})(cn=${q})(mail=${q}))`, scope: 'sub' as const, attributes: ['*'] };
        client.search(BASE_DN!, opts, (err: any, ldapRes: any) => {
          if (err) return reject(err);
          let user: any = null;
          ldapRes.on('searchEntry', (entry: any) => {
            try {
              if (entry && entry.object && Object.keys(entry.object).length) {
                user = entry.object;
                return;
              }
            } catch {}
            if (entry && Array.isArray(entry.attributes) && entry.attributes.length) {
              const obj: Record<string, any> = {};
              for (const attr of entry.attributes) {
                try {
                  const vals = (attr && (attr.values || attr.vals || attr._vals)) || attr;
                  if (Array.isArray(vals) && vals.length === 1) obj[attr.type || attr.typeName || attr.attribute] = vals[0];
                  else obj[attr.type || attr.typeName || attr.attribute] = vals;
                } catch {
                  obj[attr.type || attr.typeName || attr.attribute] = attr;
                }
              }
              user = obj;
              return;
            }
          });
          ldapRes.on('error', (e: any) => reject(e));
          ldapRes.on('end', () => resolve(user));
        });
      });

      for (const loc of workLocations) {
        try {
          const employeeMarker = await storage.getMarker(loc.id, 'employee');
          const login = employeeMarker?.value?.trim();
          if (!login) {
            results.push({ id: loc.id, status: 'skipped', reason: 'no employee marker' });
            continue;
          }

          const user = await searchByLogin(login);
          if (!user) {
            results.push({ id: loc.id, login, status: 'not_found' });
            continue;
          }

          // Fetch current stored location to compare
          const current = await storage.getLocation(loc.id);
          const currentName = current?.name || '';
          const currentCF: Record<string, any> = (current && current.customFields && typeof current.customFields === 'object') ? { ...(current.customFields as any) } : {};

          // Build desired values from AD (same mapping as quick add)
          const nameParts: string[] = [];
          if (user.cn) nameParts.push(user.cn as string);
          if ((user as any).middleName) nameParts.push((user as any).middleName as string);
          const desiredName = nameParts.length ? nameParts.join(' ') : (currentName || login);

          const desiredCF: Record<string, any> = { ...currentCF };
          if (user.department) desiredCF.department = user.department;
          if (user.title) desiredCF.position = user.title;
          if (user.mail) desiredCF.email = user.mail;
          if (user.extensionAttribute3) desiredCF.telegram = user.extensionAttribute3;
          if (user.mailNickname) desiredCF.logonCount = user.mailNickname;

          // Try to fetch thumbnailPhoto from AD (best-effort). If failed, ignore avatar update.
          let photoBase64: string | null = null;
          try {
            const q2 = escapeLdapFilter(login);
            const opts2 = { filter: `(|(sAMAccountName=${q2})(userPrincipalName=${q2})(cn=${q2})(mail=${q2}))`, scope: 'sub' as const, attributes: ['thumbnailPhoto'] };
            const photoBuffer: Buffer | null = await new Promise((resolve, reject) => {
              let buf: Buffer | null = null;
              client.search(BASE_DN!, opts2, (err: any, ldapRes: any) => {
                if (err) return reject(err);
                ldapRes.on('searchEntry', (entry: any) => {
                  try {
                    if (entry && entry.raw && entry.raw.thumbnailPhoto && Buffer.isBuffer(entry.raw.thumbnailPhoto)) {
                      buf = entry.raw.thumbnailPhoto;
                      return;
                    }
                    if (Array.isArray(entry.attributes)) {
                      for (const attr of entry.attributes) {
                        const key = (attr.type || attr.typeName || attr.attribute);
                        if (key === 'thumbnailPhoto') {
                          const vals = (attr && (attr.buffers || (attr as any)._vals || attr.values || attr.vals));
                          if (Array.isArray(vals) && vals[0] && Buffer.isBuffer(vals[0])) { buf = vals[0]; break; }
                          if (Buffer.isBuffer(vals)) { buf = vals; break; }
                        }
                      }
                    }
                  } catch {}
                });
                ldapRes.on('error', (e: any) => reject(e));
                ldapRes.on('end', () => resolve(buf));
              });
            });
            if (photoBuffer) {
              photoBase64 = (photoBuffer as Buffer).toString('base64');
            }
          } catch (e) {
            // ignore avatar fetch errors - proceed with other updates
          }

          // Determine if anything actually changed
          let didChange = false;
          if (desiredName !== currentName) didChange = true;
          const cfSame = JSON.stringify(desiredCF || {}) === JSON.stringify(currentCF || {});
          if (!cfSame) didChange = true;

          // Avatar change check: compare thumbnailPhoto in current customFields with fetched photo
          if (photoBase64) {
            const existingThumb = currentCF?.thumbnailPhoto || null;
            if (!existingThumb || existingThumb !== photoBase64) {
              didChange = true;
            }
          }

          if (!didChange) {
            results.push({ id: loc.id, login, status: 'skipped', reason: 'no changes' });
            continue;
          }

          // Apply updates: name/customFields first (include thumbnailPhoto if we already have it)
          try {
            const updatePayload: any = { id: loc.id };
            if (desiredName !== currentName) updatePayload.name = desiredName;
            // include desiredCF; if we will set thumbnailPhoto later, let it be included now
            updatePayload.customFields = { ...desiredCF };
            if (photoBase64) {
              // include thumbnailPhoto so a single update may be enough
              updatePayload.customFields.thumbnailPhoto = photoBase64;
              // and also data URL for immediate client display
              try {
                const mimeType = 'image/jpeg';
                updatePayload.customFields.avatar = `data:${mimeType};base64,${photoBase64}`;
              } catch {}
            }
            await storage.updateLocation(updatePayload as any);
          } catch (e) {
            // ignore field update errors
          }

          // If photoBase64 is present, ensure avatar record exists and is up-to-date
          if (photoBase64) {
            try {
              const existing = await storage.getAvatarByLocation(loc.id);
              // Compare existing avatar content if possible: easiest is to compare currentCF.thumbnailPhoto
              const currentThumb = currentCF?.thumbnailPhoto || null;
              if (!currentThumb || currentThumb !== photoBase64) {
                try { if (existing) await storage.deleteAvatar(existing.id); } catch {}
                const base64 = photoBase64;
                const originalName = `${login}.jpg`;
                const mimeType = 'image/jpeg';
                const size = Buffer.from(base64, 'base64').length;
                await storage.createAvatar({ locationId: loc.id, originalName, mimeType, size, data: base64 });
                // Update location.customFields with avatar dataUrl and thumbnailPhoto
                try {
                  const cur2 = await storage.getLocation(loc.id);
                  if (cur2) {
                    const existingCF2 = (cur2.customFields as Record<string, any>) || {};
                    const dataUrl = `data:image/jpeg;base64,${base64}`;
                    const updatedCF2 = { ...existingCF2, avatar: dataUrl, thumbnailPhoto: base64 };
                    await storage.updateLocation({ id: cur2.id, customFields: updatedCF2 } as any);
                  }
                } catch (e) {
                  // ignore avatar customFields update errors
                }
              }
            } catch (e) {
              // ignore avatar sync errors
            }
          }

          // notify clients that location updated
          try { broadcast({ type: 'LOCATION_UPDATED', location: await storage.getLocation(loc.id) }); } catch {}
          results.push({ id: loc.id, login, status: 'updated' });
        } catch (e: any) {
          results.push({ id: loc.id, status: 'error', reason: String(e?.message || e) });
        }
      }

      client.removeListener('error', onClientError);
      try { client.unbind(); } catch {}

      return res.json({ success: true, updated: results.filter(r => r.status === 'updated').length, details: results });
    } catch (error) {
      return res.status(500).json({ message: "Не удалось запустить синхронизацию" });
    }
  });

  // Create avatar for a location by fetching thumbnailPhoto from AD
  app.post("/api/admin/locations/:locationId/avatar-from-ad", requireRole(['admin']), async (req, res) => {
    try {
      const login = String(req.query.login || req.body.login || "").trim();
      if (!login) return res.status(400).json({ message: "login required" });

      const LDAP_URL = process.env.LDAP_URL;
      const BIND_DN = process.env.LDAP_BIND_DN;
      const BIND_PASSWORD = process.env.LDAP_BIND_PASSWORD;
      const BASE_DN = process.env.LDAP_BASE_DN;

      if (!LDAP_URL || !BIND_DN || !BIND_PASSWORD || !BASE_DN) {
        return res.status(500).json({ message: 'LDAP is not configured on server' });
      }

      const client = ldap.createClient({ url: LDAP_URL });
      let clientErrored = false;
      const onClientError = (err: any) => {
        clientErrored = true;
      };
      client.on('error', onClientError);

      // bind similarly to ldap-user route (try a few candidates)
      const candidates: string[] = [];
      if (BIND_DN) candidates.push(BIND_DN);
      let rdnName: string | null = null;
      try {
        if (BIND_DN && BIND_DN.includes(',')) {
          const first = BIND_DN.split(',')[0];
          if (first.includes('=')) rdnName = first.split('=')[1];
        }
      } catch (e) {}
      if (rdnName) candidates.push(rdnName);
      let domain: string | null = null;
      try {
        if (BASE_DN) {
          const parts = BASE_DN.split(',').map(p => p.trim()).filter(p => p.toUpperCase().startsWith('DC='));
          domain = parts.map(p => p.split('=')[1]).join('.');
        }
      } catch (e) { domain = null; }
      if (rdnName && domain) candidates.push(`${rdnName}@${domain}`);

      let bound = false;
      let lastBindError: any = null;
      for (const bindStr of candidates) {
        if (!bindStr) continue;
        try {
          await new Promise<void>((resolve, reject) => {
            let called = false;
            client.bind(bindStr, BIND_PASSWORD, (err: Error | null) => {
              if (called) return;
              called = true;
              if (err) return reject(err);
              resolve();
            });
            setTimeout(() => { if (!called) { called = true; reject(new Error('LDAP bind timeout')); } }, 5000);
          });
          bound = true;
          break;
        } catch (err) {
          lastBindError = err;
        }
      }

      if (!bound) {
        client.removeListener('error', onClientError);
        try { client.unbind(); } catch (e) {}
        securityLogger.warn('LDAP bind failed in avatar-ad endpoint', {
          login,
          error: String(lastBindError),
          adminId: req.session?.adminId,
          ip: req.ip,
          userAgent: req.get('user-agent')
        });
        return res.status(500).json({ message: 'LDAP bind failed', details: String(lastBindError) });
      }

      // search for thumbnailPhoto attribute
      const q = escapeLdapFilter(login);
      const opts = {
        filter: `(|(sAMAccountName=${q})(userPrincipalName=${q})(cn=${q})(mail=${q}))`,
        scope: 'sub' as const,
        attributes: ['thumbnailPhoto']
      };

      client.search(BASE_DN, opts, (err: Error | null, ldapRes: any) => {
        if (err) {
          client.removeListener('error', onClientError);
          client.unbind();
          return res.status(500).json({ message: 'LDAP search error', details: String(err) });
        }

        let photoBuffer: Buffer | null = null;
        ldapRes.on('searchEntry', (entry: any) => {
          try {
            // ldapjs may expose raw attributes on entry.raw or entry.attributes
            if (entry && entry.raw && entry.raw.thumbnailPhoto) {
              const val = entry.raw.thumbnailPhoto;
              if (Buffer.isBuffer(val)) photoBuffer = val;
            }
            if (!photoBuffer && Array.isArray(entry.attributes)) {
              for (const attr of entry.attributes) {
                if ((attr.type || attr.typeName || attr.attribute) === 'thumbnailPhoto') {
                  const vals = (attr && (attr.buffers || attr._vals || attr.values || attr.vals));
                  if (Array.isArray(vals) && vals[0] && Buffer.isBuffer(vals[0])) {
                    photoBuffer = vals[0];
                    break;
                  }
                  if (Buffer.isBuffer(vals)) { photoBuffer = vals; break; }
                }
              }
            }
          } catch (e) {
            // ignore
          }
        });

        ldapRes.on('error', (err: any) => {
          client.removeListener('error', onClientError);
          client.unbind();
          return res.status(500).json({ message: 'LDAP response error', details: String(err) });
        });

        ldapRes.on('end', async () => {
          client.removeListener('error', onClientError);
          client.unbind();
          if (!photoBuffer) {
            return res.status(404).json({ message: 'thumbnailPhoto not found for user' });
          }

          try {
            // remove existing avatar for this location
            const existing = await storage.getAvatarByLocation(req.params.locationId);
            if (existing) {
              await storage.deleteAvatar(existing.id);
            }

            const base64 = photoBuffer.toString('base64');
            const originalName = `${login}.jpg`;
            const mimeType = 'image/jpeg';
            const size = photoBuffer.length;

            const avatar = await storage.createAvatar({ locationId: req.params.locationId, originalName, mimeType, size, data: base64 });

            // Также обновим customFields у локации, чтобы клиент видел аватар сразу (LocationModal ожидает avatar в location.customFields.avatar)
            try {
              const location = await storage.getLocation(req.params.locationId);
              if (location) {
                const existingCF = (location.customFields as Record<string, any>) || {};
                const dataUrl = `data:${mimeType};base64,${base64}`;
                const updatedCF = { ...existingCF, avatar: dataUrl, thumbnailPhoto: base64 };
                // updateLocation accepts partial update with id
                await storage.updateLocation({ id: location.id, customFields: updatedCF } as any);
                const updatedLocation = await storage.getLocation(req.params.locationId);
                if (updatedLocation) broadcast({ type: 'LOCATION_UPDATED', location: updatedLocation });
              }
            } catch (e) {
              // ignore avatar customFields update errors
            }

            return res.status(201).json(avatar);
          } catch (e) {
            return res.status(500).json({ message: 'Failed to save avatar', details: String(e) });
          }
        });
      });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create HTTP or HTTPS server based on available certificates in ../crt
  const crtDir = path.resolve(__dirname, '..', 'crt');
  let httpServer: Server | undefined;
  try {
    const pfxPath = path.join(crtDir, 'map.spectrum.int.pfx');
    const keyPath = path.join(crtDir, 'map.spectrum.int.key');
    const certPath = path.join(crtDir, 'map.spectrum.int.crt');

    if (fs.existsSync(pfxPath)) {
      try {
        const pfx = fs.readFileSync(pfxPath);
        const passphrase = process.env.SSL_PFX_PASSPHRASE || undefined;
        httpServer = https.createServer({ pfx, passphrase }, app) as unknown as Server;
      } catch (e) {
        // continue with HTTP fallback
      }
    } else if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      try {
        const key = fs.readFileSync(keyPath);
        const cert = fs.readFileSync(certPath);
        httpServer = https.createServer({ key, cert }, app) as unknown as Server;
      } catch (e) {
        // continue with HTTP fallback
      }
    }
  } catch (e) {
    // continue with HTTP fallback
  }

  if (!httpServer) {
    // fallback to plain HTTP
    httpServer = createHttpServer(app);
  }

  // Setup WebSocket server - conditionally enabled
  const websocketsEnabled = process.env.WEBSOCKETS_ENABLED !== 'false';
  
  if (websocketsEnabled) {
    try {
      const wss = new WebSocketServer({ 
        server: httpServer,
        path: '/ws',
        verifyClient: ({ req }, done) => {
          done(true);
        }
      });

      wss.on('connection', (ws, req) => {
        wsClients.add(ws);
        
        ws.on('close', () => {
          wsClients.delete(ws);
        });

        ws.on('error', (error) => {
          wsClients.delete(ws);
        });
      });
    } catch (error) {
      // WebSocket server failed to initialize, continue without it
    }
  }

  // Initialize AD Sync Scheduler
  try {
    adSyncScheduler.start();
  } catch (error) {
    console.error('Failed to start AD Sync Scheduler:', error);
  }

  // Initialize Socket Port Scheduler
  try {
    // Set broadcast function for socket port scheduler to notify clients of updates
    socketPortScheduler.setBroadcastFn(broadcast);
    socketPortScheduler.start();
    const spsStatus = socketPortScheduler.getStatus();
    console.log(`Socket Port Scheduler started with ${Math.round(spsStatus.intervalMs / 60000)}-minute batch intervals, batchSize=${spsStatus.batchSize}`);
  } catch (error) {
    console.error('Failed to start Socket Port Scheduler:', error);
  }

  return httpServer as Server;
}
