import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";
import dotenv from "dotenv";
import { setupVite, serveStatic, log } from "./vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env: prefer project-root .env, allow overriding via DOTENV_PATH,
// otherwise fall back to the legacy absolute path used by the original author.
const projectEnvPath = path.resolve(__dirname, '..', '.env');
// user requested path: prefer this location if present
const userEnvDir = 'C:\\Users\\sedyh.a\\Desktop\\1';
const legacyEnvPath = path.resolve(userEnvDir, '.env');
const dotenvPath = (function () {
  // explicit override via environment variable
  if (process.env.DOTENV_PATH && fs.existsSync(process.env.DOTENV_PATH)) return process.env.DOTENV_PATH;
  // prefer user-provided legacy path when present
  if (fs.existsSync(legacyEnvPath)) return legacyEnvPath;
  // fallback to project .env
  if (fs.existsSync(projectEnvPath)) return projectEnvPath;
  // default to user legacy path if none exist
  return legacyEnvPath;
})();
dotenv.config({ path: dotenvPath });

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

(async () => {
  // dynamic import of routes after dotenv is loaded to ensure env vars (DATABASE_URL) are available
  const { registerRoutes } = await import("./routes");
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Determine if HTTPS is being used by checking crt files and choose default port
  // If local certificates exist, default to 443 so the app is available via standard HTTPS
  const crtDir = path.resolve(__dirname, '..', 'crt');
  const pfxPath = path.join(crtDir, 'map.spectrum.int.pfx');
  const keyPath = path.join(crtDir, 'map.spectrum.int.key');
  const certPath = path.join(crtDir, 'map.spectrum.int.crt');
  const hasLocalCerts = (() => {
    try { return fs.existsSync(pfxPath) || (fs.existsSync(keyPath) && fs.existsSync(certPath)); } catch { return false; }
  })();

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // If not specified, default to 443 when HTTPS certs are present, otherwise 5000.
  const defaultPort = hasLocalCerts ? '443' : '5000';
  const port = parseInt(process.env.PORT || defaultPort, 10);

  // Setup HTTP to HTTPS redirect if HTTPS is enabled
  if (hasLocalCerts) {
    const redirectApp = express();
    // Redirect all HTTP requests to HTTPS
    redirectApp.all('*', (req, res) => {
      const host = req.get('host')?.split(':')[0] || 'map.spectrum.int';
      res.redirect(301, `https://${host}:${port}${req.url}`);
    });
    redirectApp.listen(3000, '0.0.0.0', () => {
      log('HTTP → HTTPS redirection enabled on port 3000');
    });
  }

  server.listen(port, "0.0.0.0", () => {
    // Determine if HTTPS is being used by checking crt files
    const crtDir = path.resolve(__dirname, '..', 'crt');
    const pfxPath = path.join(crtDir, 'map.spectrum.int.pfx');
    const keyPath = path.join(crtDir, 'map.spectrum.int.key');
    const certPath = path.join(crtDir, 'map.spectrum.int.crt');
    const isHttps = (() => {
      try { return fs.existsSync(pfxPath) || (fs.existsSync(keyPath) && fs.existsSync(certPath)); } catch { return false; }
    })();

    const protocol = isHttps ? 'https' : 'http';

  // collect local IPv4 addresses
  const ifaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const name of Object.keys(ifaces)) {
      const nets = ifaces[name] || [];
      for (const net of nets) {
        if (net.family === 'IPv4' && !net.internal) {
          ips.push(net.address);
        }
      }
    }

    log(`serving on port ${port} (accessible from network)`);
    log(`Available URLs:`);
    log(`  - ${protocol}://map.spectrum.int:${port}`);
    for (const ip of ips) {
      log(`  - ${protocol}://${ip}:${port}`);
    }
  });
})();
