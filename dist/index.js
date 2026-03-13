var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  admins: () => admins,
  avatars: () => avatars,
  floors: () => floors,
  insertAdminSchema: () => insertAdminSchema,
  insertAvatarSchema: () => insertAvatarSchema,
  insertFloorSchema: () => insertFloorSchema,
  insertLocationSchema: () => insertLocationSchema,
  insertMarkerSchema: () => insertMarkerSchema,
  insertPublicLinkSchema: () => insertPublicLinkSchema,
  locations: () => locations,
  markers: () => markers,
  publicLinks: () => publicLinks,
  sessions: () => sessions,
  updateAvatarSchema: () => updateAvatarSchema,
  updateLocationSchema: () => updateLocationSchema,
  updateMarkerSchema: () => updateMarkerSchema,
  updatePublicLinkSchema: () => updatePublicLinkSchema
});
import { sql } from "drizzle-orm";
import { pgTable, varchar, text, integer, jsonb, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var admins, floors, locations, sessions, avatars, markers, publicLinks, insertAdminSchema, insertFloorSchema, insertLocationSchema, updateLocationSchema, insertMarkerSchema, updateMarkerSchema, insertAvatarSchema, updateAvatarSchema, insertPublicLinkSchema, updatePublicLinkSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    admins = pgTable("admins", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      username: varchar("username").notNull().unique(),
      password: varchar("password").notNull(),
      role: varchar("role").notNull().default("admin"),
      // 'admin' | 'hr'
      createdAt: timestamp("created_at").defaultNow()
    });
    floors = pgTable("floors", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      // Short human-readable code that matches locations.floor, e.g. "5", "9", "МСК"
      code: varchar("code").notNull().unique(),
      // Optional name shown in UI
      name: varchar("name"),
      // Public URL to the uploaded floor plan image
      imageUrl: text("image_url"),
      // MIME type of the uploaded image (image/png, image/jpeg, image/svg+xml, etc.)
      mimeType: varchar("mime_type"),
      // Whether this floor should be shown in public mode
      showInPublic: boolean("show_in_public").default(true),
      // Sort order for displaying floors
      sortOrder: integer("sort_order").default(0),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    locations = pgTable("locations", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      name: varchar("name").notNull(),
      type: varchar("type").notNull(),
      // 'meeting-room', 'workstation', 'equipment', 'common-area', 'socket'
      status: varchar("status").notNull().default("available"),
      // 'available', 'occupied', 'maintenance'
      // customFields для socket может содержать { port: "Gi1/0/11" }
      floor: varchar("floor").notNull().default("5"),
      // '5', '9', 'МСК'
      capacity: integer("capacity"),
      equipment: text("equipment"),
      employee: varchar("employee"),
      inventoryId: varchar("inventory_id"),
      x: real("x").notNull(),
      // X coordinate on map
      y: real("y").notNull(),
      // Y coordinate on map
      width: real("width").notNull().default(80),
      // Width in pixels
      height: real("height").notNull().default(60),
      // Height in pixels
      customColor: varchar("custom_color"),
      // Color for common-area locations
      customFields: jsonb("custom_fields").default({}).notNull().$type(),
      // JSON object for custom fields
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    sessions = pgTable("sessions", {
      sid: varchar("sid").primaryKey(),
      sess: jsonb("sess").notNull(),
      expire: timestamp("expire").notNull()
    });
    avatars = pgTable("avatars", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      locationId: varchar("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
      originalName: varchar("original_name").notNull(),
      // Оригинальное имя файла
      mimeType: varchar("mime_type").notNull(),
      // Тип файла (image/jpeg, image/png, etc)
      size: integer("size").notNull(),
      // Размер файла в байтах
      data: text("data").notNull(),
      // Base64-encoded изображение
      thumbnailData: text("thumbnail_data"),
      // Base64-encoded уменьшенная версия (опционально)
      width: integer("width"),
      // Ширина изображения в пикселях
      height: integer("height"),
      // Высота изображения в пикселях
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    markers = pgTable("markers", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      locationId: varchar("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
      key: varchar("key").notNull(),
      // например 'avatar', 'department', etc.
      value: text("value").notNull(),
      // хранит значение (для аватарок - base64 строка)
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    publicLinks = pgTable("public_links", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      title: varchar("title").notNull(),
      url: text("url").notNull(),
      sortOrder: integer("sort_order").default(0),
      // Для управления порядком отображения
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    insertAdminSchema = createInsertSchema(admins).pick({
      username: true,
      password: true,
      role: true
    });
    insertFloorSchema = createInsertSchema(floors).pick({
      code: true,
      name: true,
      imageUrl: true,
      mimeType: true,
      sortOrder: true,
      showInPublic: true
    });
    insertLocationSchema = createInsertSchema(locations).pick({
      name: true,
      type: true,
      status: true,
      floor: true,
      capacity: true,
      equipment: true,
      employee: true,
      inventoryId: true,
      x: true,
      y: true,
      width: true,
      height: true,
      customColor: true,
      customFields: true
    });
    updateLocationSchema = insertLocationSchema.partial().extend({
      id: z.string()
    });
    insertMarkerSchema = createInsertSchema(markers).pick({
      locationId: true,
      key: true,
      value: true
    });
    updateMarkerSchema = insertMarkerSchema.partial().extend({
      id: z.string()
    });
    insertAvatarSchema = createInsertSchema(avatars).pick({
      locationId: true,
      originalName: true,
      mimeType: true,
      size: true,
      data: true,
      thumbnailData: true,
      width: true,
      height: true
    });
    updateAvatarSchema = insertAvatarSchema.partial().extend({
      id: z.string()
    });
    insertPublicLinkSchema = createInsertSchema(publicLinks).pick({
      title: true,
      url: true,
      sortOrder: true
    });
    updatePublicLinkSchema = insertPublicLinkSchema.partial().extend({
      id: z.string()
    });
  }
});

// server/db.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
var pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to configure PostgreSQL?"
      );
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 2e3
    });
    db = drizzle(pool, { schema: schema_exports });
  }
});

// server/storage.ts
import { eq, and, sql as sql2 } from "drizzle-orm";
var DatabaseStorage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_schema();
    init_db();
    DatabaseStorage = class {
      // Admin operations
      async getAdminByUsername(username) {
        const [admin] = await db.select().from(admins).where(eq(admins.username, username));
        return admin;
      }
      async getAdminById(id) {
        const [admin] = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
        return admin;
      }
      async updateAdminPassword(username, hashedPassword) {
        const [admin] = await db.update(admins).set({ password: hashedPassword }).where(eq(admins.username, username)).returning();
        return admin;
      }
      async createAdmin(insertAdmin) {
        const [admin] = await db.insert(admins).values(insertAdmin).returning();
        return admin;
      }
      // Floor operations
      async getFloors() {
        return await db.select().from(floors).orderBy(floors.sortOrder);
      }
      async getFloorByCode(code) {
        const [floor] = await db.select().from(floors).where(eq(floors.code, code)).limit(1);
        return floor;
      }
      async createFloor(insertFloor) {
        const [floor] = await db.insert(floors).values(insertFloor).returning();
        return floor;
      }
      async updateFloor(id, updateData) {
        console.log("storage.updateFloor - input:", { id, updateData });
        const [floor] = await db.update(floors).set({ ...updateData, updatedAt: /* @__PURE__ */ new Date() }).where(eq(floors.id, id)).returning();
        console.log("storage.updateFloor - result:", floor);
        return floor;
      }
      async updateFloorsOrder(ids) {
        console.log("updateFloorsOrder called with ids:", ids);
        await db.transaction(async (tx) => {
          for (let i = 0; i < ids.length; i++) {
            console.log(` - updating ${ids[i]} => sortOrder=${i}`);
            await tx.update(floors).set({ sortOrder: i, updatedAt: /* @__PURE__ */ new Date() }).where(eq(floors.id, ids[i]));
          }
        });
        console.log("updateFloorsOrder completed");
      }
      async deleteFloor(id) {
        await db.delete(floors).where(eq(floors.id, id));
      }
      // Location operations
      async getAllLocations() {
        return await db.select().from(locations);
      }
      async getLocationsByFloor(floor) {
        return await db.select().from(locations).where(eq(locations.floor, floor));
      }
      async getLocation(id) {
        const [location] = await db.select().from(locations).where(eq(locations.id, id));
        return location;
      }
      async createLocation(insertLocation) {
        const { customFields, ...rest } = insertLocation;
        const [location] = await db.insert(locations).values({
          ...rest,
          customFields: sql2`${JSON.stringify(customFields || {})}::jsonb`,
          updatedAt: /* @__PURE__ */ new Date()
        }).returning();
        return location;
      }
      async updateLocation(updateLocation) {
        const { id, customFields, ...updateData } = updateLocation;
        const updateSet = {
          ...updateData,
          updatedAt: /* @__PURE__ */ new Date()
        };
        if (customFields !== void 0) {
          updateSet.customFields = sql2`${JSON.stringify(customFields)}::jsonb`;
        }
        const [location] = await db.update(locations).set(updateSet).where(eq(locations.id, id)).returning();
        return location;
      }
      async deleteLocation(id) {
        await db.delete(locations).where(eq(locations.id, id));
      }
      // Marker operations
      async getMarkersByLocation(locationId) {
        return await db.select().from(markers).where(eq(markers.locationId, locationId));
      }
      async getMarker(idOrLocationId, key) {
        if (key === void 0) {
          const [marker] = await db.select().from(markers).where(eq(markers.id, idOrLocationId)).limit(1);
          return marker;
        } else {
          const [marker] = await db.select().from(markers).where(and(eq(markers.locationId, idOrLocationId), eq(markers.key, key))).limit(1);
          return marker;
        }
      }
      async createMarker(insertMarker) {
        const [marker] = await db.insert(markers).values({
          ...insertMarker,
          updatedAt: /* @__PURE__ */ new Date()
        }).returning();
        return marker;
      }
      async updateMarker(updateMarker) {
        const { id, ...updateData } = updateMarker;
        const [marker] = await db.update(markers).set({
          ...updateData,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(markers.id, id)).returning();
        return marker;
      }
      async deleteMarker(id) {
        await db.delete(markers).where(eq(markers.id, id));
      }
      async deleteMarkersByLocation(locationId) {
        await db.delete(markers).where(eq(markers.locationId, locationId));
      }
      // Avatar operations
      async getAvatar(id) {
        const [avatar] = await db.select().from(avatars).where(eq(avatars.id, id)).limit(1);
        return avatar;
      }
      async getAvatarByLocation(locationId) {
        const [avatar] = await db.select().from(avatars).where(eq(avatars.locationId, locationId)).limit(1);
        return avatar;
      }
      async createAvatar(insertAvatar) {
        const [avatar] = await db.insert(avatars).values({
          ...insertAvatar,
          updatedAt: /* @__PURE__ */ new Date()
        }).returning();
        return avatar;
      }
      async updateAvatar(updateAvatar) {
        const { id, ...updateData } = updateAvatar;
        const [avatar] = await db.update(avatars).set({
          ...updateData,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(avatars.id, id)).returning();
        return avatar;
      }
      async deleteAvatar(id) {
        await db.delete(avatars).where(eq(avatars.id, id));
      }
      async deleteAvatarByLocation(locationId) {
        await db.delete(avatars).where(eq(avatars.locationId, locationId));
      }
      // Public links operations
      async getPublicLinks() {
        return await db.select().from(publicLinks).orderBy(publicLinks.sortOrder);
      }
      async getPublicLink(id) {
        const [link] = await db.select().from(publicLinks).where(eq(publicLinks.id, id)).limit(1);
        return link;
      }
      async createPublicLink(insertLink) {
        const [link] = await db.insert(publicLinks).values({
          ...insertLink,
          updatedAt: /* @__PURE__ */ new Date()
        }).returning();
        return link;
      }
      async updatePublicLink(updateLink) {
        const { id, ...updateData } = updateLink;
        const [link] = await db.update(publicLinks).set({
          ...updateData,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(publicLinks.id, id)).returning();
        return link;
      }
      async deletePublicLink(id) {
        await db.delete(publicLinks).where(eq(publicLinks.id, id));
      }
    };
    storage = new DatabaseStorage();
  }
});

// server/ad-sync-scheduler.ts
import cron from "node-cron";
import winston from "winston";
import ldap from "ldapjs";
var logger, ADSyncScheduler, adSyncScheduler;
var init_ad_sync_scheduler = __esm({
  "server/ad-sync-scheduler.ts"() {
    "use strict";
    init_storage();
    logger = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp: timestamp2, level, message }) => `[${timestamp2}] ${level.toUpperCase()}: ${message}`)
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: "logs/ad-sync.log" })
      ]
    });
    ADSyncScheduler = class {
      task = null;
      config;
      isRunning = false;
      lastSyncTime = null;
      lastSyncSuccess = false;
      constructor(config = {}) {
        this.config = {
          enabled: config.enabled !== false,
          schedule: config.schedule || "0 23 * * *",
          // 23:00 каждый день
          retryAttempts: config.retryAttempts || 3,
          retryDelay: config.retryDelay || 5e3
          // 5 секунд
        };
      }
      start() {
        if (!this.config.enabled) {
          logger.info("AD Sync Scheduler is disabled");
          return;
        }
        if (this.task) {
          logger.warn("AD Sync Scheduler is already running");
          return;
        }
        if (!cron.validate(this.config.schedule)) {
          logger.error(`Invalid cron schedule: ${this.config.schedule}`);
          throw new Error(`Invalid cron schedule: ${this.config.schedule}`);
        }
        this.task = cron.schedule(this.config.schedule, () => {
          this.executeSync();
        });
        logger.info(`AD Sync Scheduler started with schedule: ${this.config.schedule}`);
      }
      stop() {
        if (this.task) {
          this.task.stop();
          this.task = null;
          logger.info("AD Sync Scheduler stopped");
        }
      }
      async executeSync() {
        if (this.isRunning) {
          logger.warn("AD Sync is already running, skipping this scheduled execution");
          return;
        }
        this.isRunning = true;
        const startTime = /* @__PURE__ */ new Date();
        try {
          logger.info("Starting scheduled AD synchronization...");
          let lastError = null;
          for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
              await this.performSync();
              const duration = Date.now() - startTime.getTime();
              logger.info(`AD Sync completed successfully in ${duration}ms`);
              this.lastSyncTime = /* @__PURE__ */ new Date();
              this.lastSyncSuccess = true;
              return;
            } catch (error) {
              lastError = error instanceof Error ? error : new Error(String(error));
              logger.warn(`AD Sync attempt ${attempt}/${this.config.retryAttempts} failed: ${lastError.message}`);
              if (attempt < this.config.retryAttempts) {
                await this.delay(this.config.retryDelay);
              }
            }
          }
          if (lastError) {
            logger.error(`AD Sync failed after ${this.config.retryAttempts} attempts: ${lastError.message}`);
            this.lastSyncTime = /* @__PURE__ */ new Date();
            this.lastSyncSuccess = false;
          }
        } catch (error) {
          logger.error(`Unexpected error during AD Sync: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
          this.isRunning = false;
        }
      }
      async performSync() {
        logger.info("AD Sync operation started");
        try {
          const LDAP_URL = process.env.LDAP_URL;
          const BIND_DN = process.env.LDAP_BIND_DN;
          const BIND_PASSWORD = process.env.LDAP_BIND_PASSWORD;
          const BASE_DN = process.env.LDAP_BASE_DN;
          if (!LDAP_URL || !BIND_DN || !BIND_PASSWORD || !BASE_DN) {
            logger.warn("AD Sync skipped: LDAP is not configured");
            return;
          }
          const escapeLdapFilter2 = (value) => {
            if (!value) return "";
            return value.replace(/\\/g, "\\5c").replace(/\*/g, "\\2a").replace(/\(/g, "\\28").replace(/\)/g, "\\29").replace(/\x00/g, "\\00");
          };
          const client = ldap.createClient({ url: LDAP_URL });
          let clientErrored = false;
          const onClientError = (err) => {
            clientErrored = true;
          };
          client.on("error", onClientError);
          const candidates = [];
          if (BIND_DN) candidates.push(BIND_DN);
          let rdnName = null;
          try {
            if (BIND_DN && BIND_DN.includes(",")) {
              const first = BIND_DN.split(",")[0];
              if (first.includes("=")) rdnName = first.split("=")[1];
            }
          } catch (e) {
          }
          if (rdnName) candidates.push(rdnName);
          let domain = null;
          try {
            if (BASE_DN) {
              const parts = BASE_DN.split(",").map((p) => p.trim()).filter((p) => p.toUpperCase().startsWith("DC="));
              domain = parts.map((p) => p.split("=")[1]).join(".");
            }
          } catch (e) {
            domain = null;
          }
          if (rdnName && domain) candidates.push(`${rdnName}@${domain}`);
          let bound = false;
          let lastBindError = null;
          for (const bindStr of candidates) {
            if (!bindStr) continue;
            try {
              await new Promise((resolve, reject) => {
                let called = false;
                client.bind(bindStr, BIND_PASSWORD, (err) => {
                  if (called) return;
                  called = true;
                  if (err) return reject(err);
                  resolve();
                });
                setTimeout(() => {
                  if (!called) {
                    called = true;
                    reject(new Error("LDAP bind timeout"));
                  }
                }, 5e3);
              });
              bound = true;
              break;
            } catch (err) {
              lastBindError = err;
            }
          }
          if (!bound) {
            client.removeListener("error", onClientError);
            try {
              client.unbind();
            } catch (e) {
            }
            throw new Error(`LDAP bind failed: ${String(lastBindError)}`);
          }
          const all = await storage.getAllLocations();
          const workLocations = all.filter((l) => (l.type === "workstation" || !l.type) && l.id);
          let successCount = 0;
          let skippedCount = 0;
          let failedCount = 0;
          const searchByLogin = (login) => new Promise((resolve, reject) => {
            const q = escapeLdapFilter2(login);
            const opts = {
              filter: `(|(sAMAccountName=${q})(userPrincipalName=${q})(cn=${q})(mail=${q}))`,
              scope: "sub",
              attributes: ["*"]
            };
            client.search(BASE_DN, opts, (err, ldapRes) => {
              if (err) return reject(err);
              let user = null;
              ldapRes.on("searchEntry", (entry) => {
                try {
                  if (entry && entry.object && Object.keys(entry.object).length) {
                    user = entry.object;
                    return;
                  }
                } catch {
                }
                if (entry && Array.isArray(entry.attributes) && entry.attributes.length) {
                  const obj = {};
                  for (const attr of entry.attributes) {
                    try {
                      const vals = attr && (attr.values || attr.vals || attr._vals) || attr;
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
              ldapRes.on("error", (e) => reject(e));
              ldapRes.on("end", () => resolve(user));
            });
          });
          for (const loc of workLocations) {
            try {
              const employeeMarker = await storage.getMarker(loc.id, "employee");
              const login = employeeMarker?.value?.trim();
              if (!login) {
                skippedCount++;
                continue;
              }
              const user = await searchByLogin(login);
              if (!user) {
                failedCount++;
                continue;
              }
              const current = await storage.getLocation(loc.id);
              const currentName = current?.name || "";
              const currentCF = current && current.customFields && typeof current.customFields === "object" ? { ...current.customFields } : {};
              const nameParts = [];
              if (user.cn) nameParts.push(user.cn);
              if (user.middleName) nameParts.push(user.middleName);
              const desiredName = nameParts.length ? nameParts.join(" ") : currentName || login;
              const desiredCF = { ...currentCF };
              if (user.department) desiredCF.department = user.department;
              if (user.title) desiredCF.position = user.title;
              if (user.mail) desiredCF.email = user.mail;
              if (user.extensionAttribute3) desiredCF.telegram = user.extensionAttribute3;
              if (user.mailNickname) desiredCF.logonCount = user.mailNickname;
              let didChange = false;
              if (desiredName !== currentName) didChange = true;
              const cfSame = JSON.stringify(desiredCF || {}) === JSON.stringify(currentCF || {});
              if (!cfSame) didChange = true;
              if (!didChange) {
                skippedCount++;
                continue;
              }
              try {
                const updatePayload = { id: loc.id };
                if (desiredName !== currentName) updatePayload.name = desiredName;
                updatePayload.customFields = desiredCF;
                await storage.updateLocation(updatePayload);
                successCount++;
              } catch (e) {
                failedCount++;
              }
            } catch (e) {
              failedCount++;
            }
          }
          client.removeListener("error", onClientError);
          try {
            client.unbind();
          } catch {
          }
          logger.info(`AD Sync completed successfully. Updated: ${successCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(`AD Sync operation failed: ${message}`);
          throw error;
        }
      }
      delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }
      getStatus() {
        let nextExecution;
        if (this.task) {
          try {
            const nextDate = this.task.nextDate?.();
            if (nextDate && nextDate instanceof Date) {
              nextExecution = nextDate;
            }
          } catch (e) {
          }
        }
        return {
          enabled: this.config.enabled,
          isRunning: this.isRunning,
          schedule: this.config.schedule,
          nextExecution,
          lastSyncTime: this.lastSyncTime || void 0,
          lastSyncSuccess: this.lastSyncTime ? this.lastSyncSuccess : void 0
        };
      }
    };
    adSyncScheduler = new ADSyncScheduler({
      enabled: process.env.AD_SYNC_ENABLED !== "false",
      schedule: process.env.AD_SYNC_SCHEDULE || "0 23 * * *",
      // По умолчанию 23:00
      retryAttempts: parseInt(process.env.AD_SYNC_RETRY_ATTEMPTS || "3", 10),
      retryDelay: parseInt(process.env.AD_SYNC_RETRY_DELAY || "5000", 10)
    });
  }
});

// server/cisco-port-status.ts
var cisco_port_status_exports = {};
__export(cisco_port_status_exports, {
  fetchCiscoPortInfo: () => fetchCiscoPortInfo,
  getCiscoPortStatus: () => getCiscoPortStatus
});
import { Client } from "ssh2";
import dotenv from "dotenv";
import path3 from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
async function fetchCiscoPortInfo(portInput, site) {
  let port = String(portInput || "").trim();
  if (!port) throw new Error("Port is required");
  port = port.replace(/^(Gi\d\/\d\/|Fa\d\/\d\/)?(\d+)$/i, "$2");
  let siteKey = (String(site || "").trim() || "5").toLowerCase();
  const siteAliases = { "\u043C\u0441\u043A": "msk", "\u043C\u043E\u0441\u043A\u0432\u0430": "msk", "moscow": "msk", "msk": "msk" };
  siteKey = siteAliases[siteKey] || siteKey;
  const envMap = {
    "5": { host: "HOST_5", user: "CISCO_USER_5", pass: "PASSWORD_5" },
    "9": { host: "HOST_9", user: "CISCO_USER_9", pass: "PASSWORD_9" },
    "msk": { host: "HOST_MSK", user: "CISCO_USER_MSK", pass: "PASSWORD_MSK" }
  };
  const selected = envMap[siteKey] || envMap["5"];
  const host = process.env[selected.host];
  const username = process.env[selected.user] || process.env.CISCO_USER_5 || process.env["CISCO_USER_5"];
  const password = process.env[selected.pass] || process.env.PASSWORD_5 || process.env["PASSWORD_5"];
  console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] Attempting to connect to Cisco switch at ${host} for port ${port}`);
  const missing = [];
  if (!host) missing.push(selected.host);
  if (!username) missing.push(selected.user);
  if (!password) missing.push(selected.pass);
  if (missing.length) {
    const err = new Error(`Missing environment variables: ${missing.join(", ")}`);
    err.details = Object.fromEntries(missing.map((k) => [k, process.env[k] ? "***" : void 0]));
    throw err;
  }
  return await new Promise((resolve, reject) => {
    const conn = new Client();
    let result = "";
    let finished = false;
    const operationTimeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        try {
          conn.end();
        } catch (e) {
        }
        reject(new Error("Operation timeout: no response from switch"));
      }
    }, 1e4);
    conn.on("ready", () => {
      console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] SSH connection established, executing command for port ${port}`);
      conn.exec(`show interface GigabitEthernet1/0/${port} status`, (err, stream) => {
        if (err) {
          clearTimeout(operationTimeout);
          try {
            conn.end();
          } catch (e) {
          }
          finished = true;
          reject(err);
          return;
        }
        const dataTimeout = setTimeout(() => {
          if (!finished) {
            finished = true;
            try {
              stream.end();
            } catch (e) {
            }
            try {
              conn.end();
            } catch (e) {
            }
            reject(new Error("No data received from switch"));
          }
        }, 5e3);
        stream.on("close", () => {
          if (finished) return;
          finished = true;
          clearTimeout(operationTimeout);
          clearTimeout(dataTimeout);
          try {
            conn.end();
          } catch (e) {
          }
          const lines = result.split(/\r?\n/).filter((line) => line.trim());
          let dataLine = lines.find((line) => line.trim().startsWith("Gi") || line.trim().startsWith("Fa"));
          console.log("--- Cisco RAW Output ---");
          console.log(result);
          console.log("--- Parsed Line ---");
          console.log(dataLine);
          if (!dataLine) {
            const e = new Error("No port info found in output");
            e.raw = result;
            reject(e);
            return;
          }
          const pattern = /(\S+)\s+(.{0,20})\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)/;
          const match = dataLine.match(pattern);
          if (!match) {
            const e = new Error("Failed to parse port info");
            e.line = dataLine;
            reject(e);
            return;
          }
          const fields = {
            Port: match[1].trim(),
            Name: match[2].trim(),
            Status: match[3].trim(),
            Vlan: match[4].trim(),
            Duplex: match[5].trim(),
            Speed: match[6].trim(),
            Type: match[7].trim()
          };
          console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] Successfully parsed port info:`, fields);
          resolve(fields);
        }).on("data", (data) => {
          result += data.toString();
        }).stderr.on("data", (data) => {
          console.error("SSH stderr:", data.toString());
          result += data.toString();
        });
      });
    }).on("error", (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(operationTimeout);
      try {
        conn.end();
      } catch (e) {
      }
      const e2 = new Error("SSH connection error: " + err.message);
      e2.code = err.name;
      e2.hint = err.message.includes("ECONNREFUSED") ? "Port 22 may be closed or unreachable" : err.message.includes("ETIMEDOUT") ? "Connection timed out" : err.message.includes("Authentication failed") ? "Check credentials" : "Check switch reachability and network settings";
      reject(e2);
    }).connect({
      host,
      username,
      password,
      port: 22,
      readyTimeout: 5e3,
      keepaliveInterval: 1e3,
      keepaliveCountMax: 3,
      debug: process.env.NODE_ENV === "development" ? console.log : void 0,
      algorithms: {
        kex: ["diffie-hellman-group-exchange-sha1", "diffie-hellman-group14-sha1", "diffie-hellman-group1-sha1"],
        cipher: ["aes128-cbc", "3des-cbc", "aes192-cbc", "aes256-cbc"],
        serverHostKey: ["ssh-rsa"]
      }
    });
  });
}
async function getCiscoPortStatus(req, res) {
  res.set({ "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", "Pragma": "no-cache", "Expires": "0" });
  const port = String(req.query.port || "").trim();
  if (!port) return res.status(400).json({ error: "Port is required" });
  try {
    const site = String(req.query.site || "").trim();
    const data = await fetchCiscoPortInfo(port, site || void 0);
    if (!data) {
      return res.status(502).json({ error: "No data received from Cisco" });
    }
    const cleanData = {
      Port: String(data.Port || ""),
      Name: String(data.Name || ""),
      Status: String(data.Status || ""),
      Vlan: String(data.Vlan || ""),
      Duplex: String(data.Duplex || ""),
      Speed: String(data.Speed || ""),
      Type: String(data.Type || "")
    };
    try {
      JSON.stringify(cleanData);
    } catch (serializeError) {
      console.error("Failed to serialize Cisco port data:", serializeError);
      return res.status(502).json({ error: "Failed to serialize port data", details: String(serializeError) });
    }
    return res.json(cleanData);
  } catch (e) {
    console.error("getCiscoPortStatus error:", e);
    const status = e && e.message && e.message.includes("Missing environment") ? 500 : 502;
    const errorResponse = {
      error: e.message || "Error",
      details: typeof e.details === "object" ? JSON.stringify(e.details) : String(e.details || "")
    };
    return res.status(status).json(errorResponse);
  }
}
var __filename, __dirname3, envPath;
var init_cisco_port_status = __esm({
  "server/cisco-port-status.ts"() {
    "use strict";
    __filename = fileURLToPath3(import.meta.url);
    __dirname3 = path3.dirname(__filename);
    envPath = path3.resolve(__dirname3, "../.env");
    dotenv.config({ path: envPath, debug: true });
  }
});

// server/socket-port-scheduler.ts
import winston2 from "winston";
function extractPortNumber(port) {
  const match = String(port).match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}
function createPortBatches(batchSize = 10, intervalMs = 30 * 60 * 1e3) {
  const batches = [];
  for (let i = 1; i <= 48; i += batchSize) {
    const startPort = i;
    const endPort = Math.min(i + batchSize - 1, 48);
    const batchIndex = Math.floor((i - 1) / batchSize);
    batches.push({
      startPort,
      endPort,
      delayMs: batchIndex * intervalMs
    });
  }
  return batches;
}
var logger2, SocketPortScheduler, socketPortScheduler;
var init_socket_port_scheduler = __esm({
  "server/socket-port-scheduler.ts"() {
    "use strict";
    init_cisco_port_status();
    init_storage();
    logger2 = winston2.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: winston2.format.combine(
        winston2.format.timestamp(),
        winston2.format.errors({ stack: true }),
        winston2.format.splat(),
        winston2.format.json()
      ),
      defaultMeta: { service: "socket-port-scheduler" }
    });
    SocketPortScheduler = class {
      isRunning = false;
      timeouts = /* @__PURE__ */ new Map();
      // Allow overriding batch size / interval via env vars for flexibility
      batchSize = Number(process.env.SOCKET_BATCH_SIZE) || 10;
      intervalMs = (Number(process.env.SOCKET_BATCH_INTERVAL_MINUTES) || 30) * 60 * 1e3;
      // minutes
      broadcastFn;
      constructor() {
      }
      // Set broadcast function to notify clients of updates
      setBroadcastFn(fn) {
        this.broadcastFn = fn;
      }
      /**
       * Start periodic synchronization of socket port statuses
       */
      start() {
        if (this.isRunning) {
          logger2.warn("Socket Port Scheduler is already running");
          return;
        }
        this.isRunning = true;
        logger2.info("Socket Port Scheduler started");
        this.schedulePortBatches();
      }
      /**
       * Stop the scheduler and clear all pending timeouts
       */
      stop() {
        this.isRunning = false;
        logger2.info("Socket Port Scheduler stopped");
        Array.from(this.timeouts.values()).forEach((timeout) => {
          clearTimeout(timeout);
        });
        this.timeouts.clear();
      }
      /**
       * Schedule port batches with intervals
       */
      schedulePortBatches() {
        const batches = createPortBatches(this.batchSize, this.intervalMs);
        for (const batch of batches) {
          const batchKey = batch.startPort;
          const timeout = setTimeout(
            () => this.processBatch(batch),
            batch.delayMs
          );
          this.timeouts.set(batchKey, timeout);
          logger2.info(
            `Batch [${batch.startPort}-${batch.endPort}] scheduled to run in ${batch.delayMs / 1e3}s (${batch.delayMs / 6e4} min)`
          );
        }
      }
      /**
       * Process a batch of ports
       */
      async processBatch(batch) {
        logger2.info(`Processing batch [${batch.startPort}-${batch.endPort}]`);
        try {
          const allLocations = await storage.getAllLocations();
          const socketLocations = allLocations.filter(
            (loc) => loc.type === "socket" && loc.id
          );
          const batchLocations = socketLocations.filter((loc) => {
            const customFields = loc.customFields || {};
            const portStr = customFields.port || customFields.Port || "";
            const portNum = extractPortNumber(portStr);
            return portNum && portNum >= batch.startPort && portNum <= batch.endPort;
          });
          logger2.info(
            `Found ${batchLocations.length} locations in batch [${batch.startPort}-${batch.endPort}]`
          );
          for (const location of batchLocations) {
            await this.syncLocationPortStatus(location);
          }
          logger2.info(
            `Batch [${batch.startPort}-${batch.endPort}] processed successfully`
          );
          const totalBatches = Math.ceil(48 / this.batchSize);
          const batchIndex = Math.floor((batch.startPort - 1) / this.batchSize);
          const totalCycleTime = totalBatches * this.intervalMs;
          const nextCycleDelay = totalCycleTime;
          if (batchIndex === totalBatches - 1) {
            this.scheduleNextCycle(nextCycleDelay);
          }
        } catch (error) {
          logger2.error(
            `Error processing batch [${batch.startPort}-${batch.endPort}]:`,
            error
          );
        }
      }
      /**
       * Schedule the next batch cycle
       */
      scheduleNextCycle(delay) {
        Array.from(this.timeouts.values()).forEach((timeout) => {
          clearTimeout(timeout);
        });
        this.timeouts.clear();
        if (this.isRunning) {
          setTimeout(() => {
            if (this.isRunning) {
              logger2.info("Starting new port sync cycle");
              this.schedulePortBatches();
            }
          }, delay);
        }
      }
      /**
       * Sync port status for a single location
       */
      async syncLocationPortStatus(location) {
        try {
          const customFields = location.customFields && typeof location.customFields === "object" ? location.customFields : {};
          const portRaw = customFields.port || customFields.Port || "";
          const portArg = String(portRaw).split("/").pop()?.replace(/\D/g, "") || "";
          if (!portArg) {
            logger2.warn(`Location ${location.id} has no valid port number`);
            return;
          }
          const ciscoSite = customFields.ciscoSite || location.floor || "5";
          logger2.debug(
            `Syncing port ${portArg} for location ${location.id} (site: ${ciscoSite})`
          );
          let parsed;
          try {
            parsed = await fetchCiscoPortInfo(portArg, ciscoSite);
          } catch (ciscoError) {
            logger2.warn(
              `Failed to fetch Cisco info for port ${portArg}: ${ciscoError instanceof Error ? ciscoError.message : String(ciscoError)}`
            );
            return;
          }
          const nowIso = (/* @__PURE__ */ new Date()).toISOString();
          const updatedCF = {
            ...location.customFields || {}
          };
          const portVal = parsed.Port || parsed.port || "";
          if (portVal) {
            updatedCF.port = portVal;
            updatedCF.Port = portVal;
          }
          const nameVal = parsed.Name || parsed.name || "";
          if (nameVal) {
            updatedCF.Name = nameVal;
            updatedCF.name = nameVal;
          }
          const statusVal = parsed.Status || parsed.status || "";
          if (statusVal) {
            updatedCF.Status = statusVal;
            updatedCF.status = statusVal;
            updatedCF.ciscoStatus = statusVal;
            updatedCF.CiscoStatus = statusVal;
          }
          const vlanVal = parsed.Vlan || parsed.vlan || "";
          if (vlanVal) {
            updatedCF.Vlan = vlanVal;
            updatedCF.vlan = vlanVal;
          }
          const duplexVal = parsed.Duplex || parsed.duplex || "";
          if (duplexVal) {
            updatedCF.Duplex = duplexVal;
            updatedCF.duplex = duplexVal;
          }
          const speedVal = parsed.Speed || parsed.speed || "";
          if (speedVal) {
            updatedCF.Speed = speedVal;
            updatedCF.speed = speedVal;
          }
          const typeVal = parsed.Type || parsed.type || "";
          if (typeVal) {
            updatedCF.Type = typeVal;
            updatedCF.type = typeVal;
          }
          updatedCF.StatusLastSync = nowIso;
          const updatedLocation = await storage.updateLocation({
            id: location.id,
            customFields: updatedCF
          });
          logger2.info(
            `Location ${location.id} port status updated successfully`
          );
          if (this.broadcastFn && updatedLocation) {
            try {
              this.broadcastFn({
                type: "LOCATION_UPDATED",
                location: updatedLocation
              });
            } catch (e) {
              logger2.error("Error broadcasting location update for location " + location.id + ":", e);
            }
          }
        } catch (error) {
          logger2.error(
            `Error syncing port status for location ${location.id}:`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
      /**
       * Get scheduler status
       */
      getStatus() {
        return {
          isRunning: this.isRunning,
          batchSize: this.batchSize,
          intervalMs: this.intervalMs,
          timeoutsScheduled: this.timeouts.size
        };
      }
    };
    socketPortScheduler = new SocketPortScheduler();
  }
});

// server/routes.ts
var routes_exports = {};
__export(routes_exports, {
  registerRoutes: () => registerRoutes
});
import express2 from "express";
import fs2 from "fs";
import path4 from "path";
import { fileURLToPath as fileURLToPath4 } from "url";
import { createServer as createHttpServer } from "http";
import https from "https";
import { WebSocketServer, WebSocket } from "ws";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcrypt";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import winston3 from "winston";
import { z as z2 } from "zod";
import ldap2 from "ldapjs";
function translit(str) {
  const map = {
    \u0410: "A",
    \u0411: "B",
    \u0412: "V",
    \u0413: "G",
    \u0414: "D",
    \u0415: "E",
    \u0401: "E",
    \u0416: "Zh",
    \u0417: "Z",
    \u0418: "I",
    \u0419: "Y",
    \u041A: "K",
    \u041B: "L",
    \u041C: "M",
    \u041D: "N",
    \u041E: "O",
    \u041F: "P",
    \u0420: "R",
    \u0421: "S",
    \u0422: "T",
    \u0423: "U",
    \u0424: "F",
    \u0425: "Kh",
    \u0426: "Ts",
    \u0427: "Ch",
    \u0428: "Sh",
    \u0429: "Sch",
    \u042A: "",
    \u042B: "Y",
    \u042C: "",
    \u042D: "E",
    \u042E: "Yu",
    \u042F: "Ya",
    \u0430: "a",
    \u0431: "b",
    \u0432: "v",
    \u0433: "g",
    \u0434: "d",
    \u0435: "e",
    \u0451: "e",
    \u0436: "zh",
    \u0437: "z",
    \u0438: "i",
    \u0439: "y",
    \u043A: "k",
    \u043B: "l",
    \u043C: "m",
    \u043D: "n",
    \u043E: "o",
    \u043F: "p",
    \u0440: "r",
    \u0441: "s",
    \u0442: "t",
    \u0443: "u",
    \u0444: "f",
    \u0445: "kh",
    \u0446: "ts",
    \u0447: "ch",
    \u0448: "sh",
    \u0449: "sch",
    \u044A: "",
    \u044B: "y",
    \u044C: "",
    \u044D: "e",
    \u044E: "yu",
    \u044F: "ya"
  };
  return str.split("").map((c) => map[c] || c).join("");
}
function escapeLdapFilter(value) {
  if (!value) return "";
  return value.replace(/\\/g, "\\5c").replace(/\*/g, "\\2a").replace(/\(/g, "\\28").replace(/\)/g, "\\29").replace(/\x00/g, "\\00");
}
function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1e3;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
    pruneSessionInterval: 60 * 15,
    // Clean up expired sessions every 15 minutes
    errorLog: console.error
  });
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error(
      `CRITICAL: SESSION_SECRET environment variable is required and must be a strong random string. Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }
  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "strict",
      // set secure flag automatically when local certs exist
      secure: function() {
        try {
          const crtDir = path4.resolve(__dirname4, "..", "crt");
          const pfxPath = path4.join(crtDir, "map.spectrum.int.pfx");
          const keyPath = path4.join(crtDir, "map.spectrum.int.key");
          const certPath = path4.join(crtDir, "map.spectrum.int.crt");
          if (fs2.existsSync(pfxPath)) return true;
          if (fs2.existsSync(keyPath) && fs2.existsSync(certPath)) return true;
        } catch (e) {
        }
        return false;
      }(),
      maxAge: sessionTtl
    }
  });
}
function requireAuth(req, res, next) {
  if (req.session?.adminId) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
}
function requireRole(roles) {
  return async function(req, res, next) {
    try {
      if (!req.session?.adminId) return res.status(401).json({ message: "Unauthorized" });
      const admin = await storage.getAdminById(req.session.adminId);
      if (!admin) return res.status(401).json({ message: "Unauthorized" });
      if (!("role" in admin)) return res.status(403).json({ message: "Forbidden" });
      if (!roles.includes(admin.role)) return res.status(403).json({ message: "Forbidden" });
      next();
    } catch (e) {
      res.status(500).json({ message: "Internal server error" });
    }
  };
}
async function registerRoutes(app2) {
  app2.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://replit.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        objectSrc: ["'self'"],
        connectSrc: ["'self'", "wss:", "ws:", "https://fonts.gstatic.com"]
      }
    },
    hsts: { maxAge: 31536e3, includeSubDomains: true },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  }));
  const corsOptions = {
    origin: process.env.CORS_ORIGIN || "http://localhost:5000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 3600
  };
  app2.use(cors(corsOptions));
  app2.use(getSession());
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    // 15 minutes
    max: 100,
    // 100 requests per window
    message: "Too many requests from this IP, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      try {
        if (req.session?.adminId) return true;
      } catch (e) {
      }
      if (req.method !== "POST" && req.method !== "PUT" && req.method !== "DELETE") {
        return true;
      }
      return req.path === "/api/admin/me" || req.path === "/api/capabilities";
    }
  });
  app2.use("/api/", limiter);
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: 5,
    skipSuccessfulRequests: true,
    message: "Too many login attempts from this IP, please try again later"
  });
  const { getCiscoPortStatus: getCiscoPortStatus2 } = await Promise.resolve().then(() => (init_cisco_port_status(), cisco_port_status_exports));
  app2.get("/api/cisco-port-status", getCiscoPortStatus2);
  const floorPlansDir = path4.resolve(__dirname4, "public", "floor-plans");
  fs2.mkdirSync(floorPlansDir, { recursive: true });
  app2.use("/floor-plans", express2.static(floorPlansDir));
  const wsClients = /* @__PURE__ */ new Set();
  function broadcast(data) {
    if (wsClients.size === 0) {
      return;
    }
    let message;
    try {
      message = JSON.stringify(data);
    } catch (e) {
      console.error("Failed to stringify broadcast data:", e);
      return;
    }
    wsClients.forEach((client) => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      } catch (error) {
        wsClients.delete(client);
      }
    });
  }
  const passwordResetSchema = z2.object({
    username: z2.string().min(3, "Username must be at least 3 characters").max(50, "Username must not exceed 50 characters").regex(/^[a-zA-Z0-9._-]+$/, "Username contains invalid characters"),
    newPassword: z2.string().min(12, "Password must be at least 12 characters").max(128, "Password must not exceed 128 characters").regex(/[A-Z]/, "Password must contain uppercase letters").regex(/[a-z]/, "Password must contain lowercase letters").regex(/[0-9]/, "Password must contain numbers").regex(/[^a-zA-Z0-9]/, "Password must contain special characters"),
    token: z2.string().min(32, "Invalid token")
  });
  app2.post("/api/admin/reset", async (req, res) => {
    try {
      if (!process.env.ADMIN_RESET_TOKEN) {
        return res.status(404).json({ message: "Not found" });
      }
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
  const loginSchema = z2.object({
    username: z2.string().min(3, "Username must be at least 3 characters").max(50, "Username must not exceed 50 characters"),
    password: z2.string().min(8, "Password must be at least 8 characters").max(128, "Password must not exceed 128 characters")
  });
  app2.post("/api/admin/login", loginLimiter, async (req, res) => {
    try {
      let validatedData;
      try {
        validatedData = loginSchema.parse(req.body);
      } catch (validationError) {
        securityLogger.warn("Login validation failed", {
          ip: req.ip,
          userAgent: req.get("user-agent")
        });
        return res.status(400).json({ message: "Invalid input", error: validationError });
      }
      const { username, password } = validatedData;
      const admin = await storage.getAdminByUsername(username);
      if (!admin) {
        securityLogger.warn("Login failed: user not found", {
          username,
          ip: req.ip,
          userAgent: req.get("user-agent")
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const isValid = await bcrypt.compare(password, admin.password);
      if (!isValid) {
        securityLogger.warn("Login failed: invalid password", {
          username,
          ip: req.ip,
          userAgent: req.get("user-agent")
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }
      securityLogger.info("Login successful", {
        adminId: admin.id,
        username: admin.username,
        ip: req.ip,
        userAgent: req.get("user-agent")
      });
      req.session.adminId = admin.id;
      res.json({ success: true, admin: { id: admin.id, username: admin.username, role: admin.role || "admin" } });
    } catch (error) {
      securityLogger.error("Login error", {
        error: String(error),
        ip: req.ip,
        userAgent: req.get("user-agent")
      });
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ success: true });
    });
  });
  app2.get("/api/admin/me", async (req, res) => {
    try {
      if (!req.session?.adminId) {
        return res.json({ admin: null });
      }
      const admin = await storage.getAdminById(req.session.adminId);
      if (!admin) {
        try {
          req.session.adminId = void 0;
        } catch (e) {
        }
        return res.json({ admin: null });
      }
      res.json({ admin: { id: admin.id, username: admin.username, role: admin.role || "admin" } });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/admin/ad-sync/status", requireAuth, async (req, res) => {
    try {
      const status = adSyncScheduler.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to get AD Sync status" });
    }
  });
  app2.post("/api/admin/ad-sync/trigger", requireAuth, async (req, res) => {
    try {
      const currentStatus = adSyncScheduler.getStatus();
      if (currentStatus.isRunning) {
        return res.status(409).json({
          message: "AD Sync is already running",
          status: currentStatus
        });
      }
      adSyncScheduler.executeSync().catch((error) => {
        securityLogger.error(`Manual AD Sync failed: ${error instanceof Error ? error.message : String(error)}`);
      });
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
  app2.get("/api/locations", async (req, res) => {
    try {
      const { floor } = req.query;
      let locations2;
      if (floor && typeof floor === "string") {
        locations2 = await storage.getLocationsByFloor(floor);
      } else {
        locations2 = await storage.getAllLocations();
      }
      res.json(locations2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });
  app2.get("/api/locations/:id", async (req, res) => {
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
  app2.get("/api/floors", async (_req, res) => {
    try {
      const floors2 = await storage.getFloors();
      res.json(floors2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch floors" });
    }
  });
  app2.post("/api/admin/floors", requireRole(["admin"]), async (req, res) => {
    try {
      const validated = insertFloorSchema.parse(req.body);
      const created = await storage.createFloor(validated);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create floor" });
    }
  });
  app2.put("/api/admin/floors/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const validated = insertFloorSchema.partial().parse(req.body);
      const updated = await storage.updateFloor(req.params.id, validated);
      res.json(updated);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update floor" });
    }
  });
  app2.put("/api/admin/floors/:id/order", requireRole(["admin"]), async (req, res) => {
    try {
      const bodySchema = z2.object({ sortOrder: z2.number() });
      const { sortOrder } = bodySchema.parse(req.body);
      const updated = await storage.updateFloor(req.params.id, { sortOrder });
      try {
        broadcast({ type: "FLOORS_ORDER_UPDATED" });
      } catch (e) {
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update floor order" });
    }
  });
  app2.put("/api/admin/floors/order", requireRole(["admin"]), async (req, res) => {
    try {
      const bodySchema = z2.object({ ids: z2.array(z2.string()).min(1) });
      const { ids } = bodySchema.parse(req.body);
      await storage.updateFloorsOrder(ids);
      try {
        broadcast({ type: "FLOORS_ORDER_UPDATED", ids });
      } catch (e) {
      }
      const floorsList = await storage.getFloors();
      res.json({ success: true, floors: floorsList });
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update floors order" });
    }
  });
  app2.delete("/api/admin/floors/:id", requireRole(["admin"]), async (req, res) => {
    try {
      await storage.deleteFloor(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete floor" });
    }
  });
  app2.post("/api/admin/floors/:id/image", requireAuth, async (req, res) => {
    try {
      const bodySchema = z2.object({ imageBase64: z2.string().min(10), filename: z2.string().optional() });
      const { imageBase64, filename } = bodySchema.parse(req.body);
      const floorsList = await storage.getFloors();
      const floor = floorsList.find((f) => f.id === req.params.id);
      if (!floor) {
        return res.status(404).json({ message: "Floor not found" });
      }
      let ext = "png";
      let mimeType = "image/png";
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
      const supportedFormats = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
      if (!supportedFormats.includes(mimeType)) {
        return res.status(400).json({ message: `Unsupported format: ${mimeType}. Supported: PNG, JPEG, SVG` });
      }
      const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, "");
      const safeCode = translit(floor.code).replace(/[^a-zA-Z0-9-_]/g, "_");
      const fileName = `${safeCode}.${ext}`;
      const filePath = path4.join(floorPlansDir, fileName);
      await fs2.promises.writeFile(filePath, Buffer.from(base64Data, "base64"));
      const publicUrl = `/floor-plans/${fileName}?t=${Date.now()}`;
      const updated = await storage.updateFloor(floor.id, { imageUrl: publicUrl, mimeType });
      res.json(updated);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to upload image" });
    }
  });
  app2.post("/api/admin/locations", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = insertLocationSchema.parse(req.body);
      const location = await storage.createLocation(validatedData);
      broadcast({ type: "LOCATION_CREATED", location });
      if (validatedData.type === "socket") {
        (async () => {
          try {
            const cfLoc = location.customFields && typeof location.customFields === "object" ? location.customFields : {};
            const portRaw = cfLoc.port || cfLoc.Port || location.name || "";
            const portArg = String(portRaw).split("/").pop()?.replace(/\D/g, "") || "";
            if (!portArg) return;
            try {
              const ciscoSite = cfLoc.ciscoSite || location.floor || "5";
              const parsed = await fetchCiscoPortInfo(portArg, ciscoSite);
              const nowIso = (/* @__PURE__ */ new Date()).toISOString();
              const updatedCF = { ...location.customFields || {} };
              const portVal = parsed.Port || parsed.port || "";
              if (portVal) {
                updatedCF.port = portVal;
                updatedCF.Port = portVal;
              }
              const nameVal = parsed.Name || parsed.name || "";
              if (nameVal) {
                updatedCF.Name = nameVal;
                updatedCF.name = nameVal;
              }
              const statusVal = parsed.Status || parsed.status || "";
              if (statusVal) {
                updatedCF.Status = statusVal;
                updatedCF.status = statusVal;
                updatedCF.ciscoStatus = statusVal;
                updatedCF.CiscoStatus = statusVal;
              }
              const vlanVal = parsed.Vlan || parsed.vlan || "";
              if (vlanVal) {
                updatedCF.Vlan = vlanVal;
                updatedCF.vlan = vlanVal;
              }
              const duplexVal = parsed.Duplex || parsed.duplex || "";
              if (duplexVal) {
                updatedCF.Duplex = duplexVal;
                updatedCF.duplex = duplexVal;
              }
              const speedVal = parsed.Speed || parsed.speed || "";
              if (speedVal) {
                updatedCF.Speed = speedVal;
                updatedCF.speed = speedVal;
              }
              const typeVal = parsed.Type || parsed.type || "";
              if (typeVal) {
                updatedCF.Type = typeVal;
                updatedCF.type = typeVal;
              }
              updatedCF.StatusLastSync = nowIso;
              await storage.updateLocation({ id: location.id, customFields: updatedCF });
              try {
                const updated = await storage.getLocation(location.id);
                if (updated) {
                  broadcast({ type: "LOCATION_UPDATED", location: updated });
                }
              } catch (e) {
              }
            } catch (err) {
              console.error("Cisco sync error for location " + location.id + ":", err);
            }
          } catch (e) {
            console.error("Async cisco-sync error:", e);
          }
        })();
      }
      res.status(201).json(location);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create location" });
    }
  });
  app2.put("/api/admin/locations/:id", requireRole(["admin", "hr"]), async (req, res) => {
    try {
      const validatedData = updateLocationSchema.parse({ id: req.params.id, ...req.body });
      const location = await storage.updateLocation(validatedData);
      broadcast({ type: "LOCATION_UPDATED", location });
      if (validatedData.type === "socket") {
        (async () => {
          try {
            const cfLoc = location.customFields && typeof location.customFields === "object" ? location.customFields : {};
            const portRaw = cfLoc.port || cfLoc.Port || location.name || "";
            const portArg = String(portRaw).split("/").pop()?.replace(/\D/g, "") || "";
            if (!portArg) return;
            try {
              const ciscoSite = cfLoc.ciscoSite || location.floor || "5";
              const parsed = await fetchCiscoPortInfo(portArg, ciscoSite);
              const nowIso = (/* @__PURE__ */ new Date()).toISOString();
              const updatedCF = { ...location.customFields || {} };
              const portVal = parsed.Port || parsed.port || "";
              if (portVal) {
                updatedCF.port = portVal;
                updatedCF.Port = portVal;
              }
              const nameVal = parsed.Name || parsed.name || "";
              if (nameVal) {
                updatedCF.Name = nameVal;
                updatedCF.name = nameVal;
              }
              const statusVal = parsed.Status || parsed.status || "";
              if (statusVal) {
                updatedCF.Status = statusVal;
                updatedCF.status = statusVal;
                updatedCF.ciscoStatus = statusVal;
                updatedCF.CiscoStatus = statusVal;
              }
              const vlanVal = parsed.Vlan || parsed.vlan || "";
              if (vlanVal) {
                updatedCF.Vlan = vlanVal;
                updatedCF.vlan = vlanVal;
              }
              const duplexVal = parsed.Duplex || parsed.duplex || "";
              if (duplexVal) {
                updatedCF.Duplex = duplexVal;
                updatedCF.duplex = duplexVal;
              }
              const speedVal = parsed.Speed || parsed.speed || "";
              if (speedVal) {
                updatedCF.Speed = speedVal;
                updatedCF.speed = speedVal;
              }
              const typeVal = parsed.Type || parsed.type || "";
              if (typeVal) {
                updatedCF.Type = typeVal;
                updatedCF.type = typeVal;
              }
              updatedCF.StatusLastSync = nowIso;
              await storage.updateLocation({ id: location.id, customFields: updatedCF });
              try {
                const updated = await storage.getLocation(location.id);
                if (updated) {
                  broadcast({ type: "LOCATION_UPDATED", location: updated });
                }
              } catch (e) {
              }
            } catch (err) {
              console.error("Cisco sync error for location " + location.id + ":", err);
            }
          } catch (e) {
            console.error("Async cisco-sync error:", e);
          }
        })();
      }
      res.json(location);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update location" });
    }
  });
  app2.delete("/api/admin/locations/:id", requireRole(["admin"]), async (req, res) => {
    try {
      await storage.deleteMarkersByLocation(req.params.id);
      await storage.deleteLocation(req.params.id);
      broadcast({ type: "LOCATION_DELETED", id: req.params.id });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete location" });
    }
  });
  app2.get("/api/locations/:locationId/markers", async (req, res) => {
    try {
      const markers2 = await storage.getMarkersByLocation(req.params.locationId);
      res.json(markers2);
    } catch (error) {
      res.status(500).json({ message: "Failed to get markers" });
    }
  });
  app2.get("/api/locations/:locationId/markers/:key", async (req, res) => {
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
  app2.post("/api/admin/locations/:locationId/markers", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = insertMarkerSchema.parse({
        ...req.body,
        locationId: req.params.locationId
      });
      const marker = await storage.createMarker(validatedData);
      const location = await storage.getLocation(req.params.locationId);
      if (location) {
        broadcast({ type: "LOCATION_UPDATED", location });
      }
      res.status(201).json(marker);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create marker" });
    }
  });
  /* @__PURE__ */ (function setupBackgroundCiscoSync() {
  })();
  app2.put("/api/admin/markers/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = updateMarkerSchema.parse({
        id: req.params.id,
        ...req.body
      });
      const marker = await storage.updateMarker(validatedData);
      const location = await storage.getLocation(marker.locationId);
      if (location) {
        broadcast({ type: "LOCATION_UPDATED", location });
      }
      res.json(marker);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update marker" });
    }
  });
  app2.delete("/api/admin/markers/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const marker = await storage.getMarker(req.params.id);
      if (!marker) {
        return res.status(404).json({ message: "Marker not found" });
      }
      await storage.deleteMarker(req.params.id);
      const location = await storage.getLocation(marker.locationId);
      if (location) {
        broadcast({ type: "LOCATION_UPDATED", location });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete marker" });
    }
  });
  app2.get("/api/locations/:locationId/avatar", async (req, res) => {
    try {
      const avatar = await storage.getAvatarByLocation(req.params.locationId);
      if (!avatar) {
        return res.json({ avatar: null });
      }
      res.json(avatar);
    } catch (error) {
      res.status(500).json({ message: "Failed to get avatar" });
    }
  });
  app2.post("/api/admin/locations/:locationId/avatar", requireRole(["admin"]), async (req, res) => {
    try {
      const existingAvatar = await storage.getAvatarByLocation(req.params.locationId);
      if (existingAvatar) {
        await storage.deleteAvatar(existingAvatar.id);
      }
      const validatedData = insertAvatarSchema.parse({
        ...req.body,
        locationId: req.params.locationId
      });
      const avatar = await storage.createAvatar(validatedData);
      const location = await storage.getLocation(req.params.locationId);
      if (location) {
        broadcast({ type: "LOCATION_UPDATED", location });
      }
      res.status(201).json(avatar);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create avatar" });
    }
  });
  app2.put("/api/admin/avatars/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = updateAvatarSchema.parse({
        id: req.params.id,
        ...req.body
      });
      const avatar = await storage.updateAvatar(validatedData);
      const location = await storage.getLocation(avatar.locationId);
      if (location) {
        broadcast({ type: "LOCATION_UPDATED", location });
      }
      res.json(avatar);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update avatar" });
    }
  });
  app2.delete("/api/admin/avatars/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const avatar = await storage.getAvatar(req.params.id);
      if (!avatar) {
        return res.status(404).json({ message: "Avatar not found" });
      }
      await storage.deleteAvatar(req.params.id);
      const location = await storage.getLocation(avatar.locationId);
      if (location) {
        broadcast({ type: "LOCATION_UPDATED", location });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete avatar" });
    }
  });
  app2.get("/api/public-links", async (_req, res) => {
    try {
      const links = await storage.getPublicLinks();
      res.json(links);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch public links" });
    }
  });
  app2.post("/api/admin/public-links", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = insertPublicLinkSchema.parse(req.body);
      const link = await storage.createPublicLink(validatedData);
      res.status(201).json(link);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create public link" });
    }
  });
  app2.put("/api/admin/public-links/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = updatePublicLinkSchema.parse({
        id: req.params.id,
        ...req.body
      });
      const link = await storage.updatePublicLink(validatedData);
      res.json(link);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update public link" });
    }
  });
  app2.delete("/api/admin/public-links/:id", requireRole(["admin"]), async (req, res) => {
    try {
      await storage.deletePublicLink(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete public link" });
    }
  });
  const iconsDir = path4.resolve(__dirname4, "..", "public", "icons");
  fs2.mkdirSync(iconsDir, { recursive: true });
  app2.use("/icons", express2.static(iconsDir));
  app2.get("/api/icons/:category", async (req, res) => {
    try {
      const category = decodeURIComponent(req.params.category);
      const categoryPath = path4.join(iconsDir, category);
      if (!path4.resolve(categoryPath).startsWith(path4.resolve(iconsDir))) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (!fs2.existsSync(categoryPath)) {
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        return res.json({ icons: [] });
      }
      const files = await fs2.promises.readdir(categoryPath);
      const svgFiles = files.filter((f) => f.toLowerCase().endsWith(".svg"));
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.json({
        icons: svgFiles.map((name) => ({
          name,
          url: `/icons/${category}/${name}`
        }))
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch icons" });
    }
  });
  app2.get("/api/capabilities", (req, res) => {
    const websocketsEnabled2 = process.env.WEBSOCKETS_ENABLED !== "false";
    res.json({
      websockets: websocketsEnabled2,
      features: {
        realTimeUpdates: websocketsEnabled2
      }
    });
  });
  app2.get("/api/admin/ldap-user", requireRole(["admin"]), async (req, res) => {
    try {
      const login = String(req.query.login || "").trim();
      if (!login) return res.status(400).json({ message: "login required" });
      const LDAP_URL = process.env.LDAP_URL;
      const BIND_DN = process.env.LDAP_BIND_DN;
      const BIND_PASSWORD = process.env.LDAP_BIND_PASSWORD;
      const BASE_DN = process.env.LDAP_BASE_DN;
      if (!LDAP_URL || !BIND_DN || !BIND_PASSWORD || !BASE_DN) {
        return res.status(500).json({ message: "LDAP is not configured on server" });
      }
      const client = ldap2.createClient({ url: LDAP_URL });
      let clientErrored = false;
      const onClientError = (err) => {
        clientErrored = true;
      };
      client.on("error", onClientError);
      const candidates = [];
      if (BIND_DN) candidates.push(BIND_DN);
      let rdnName = null;
      try {
        if (BIND_DN && BIND_DN.includes(",")) {
          const first = BIND_DN.split(",")[0];
          if (first.includes("=")) rdnName = first.split("=")[1];
        }
      } catch (e) {
      }
      if (rdnName) candidates.push(rdnName);
      let domain = null;
      try {
        if (BASE_DN) {
          const parts = BASE_DN.split(",").map((p) => p.trim()).filter((p) => p.toUpperCase().startsWith("DC="));
          domain = parts.map((p) => p.split("=")[1]).join(".");
        }
      } catch (e) {
        domain = null;
      }
      if (rdnName && domain) candidates.push(`${rdnName}@${domain}`);
      let bound = false;
      let lastBindError = null;
      for (const bindStr of candidates) {
        if (!bindStr) continue;
        try {
          await new Promise((resolve, reject) => {
            let called = false;
            client.bind(bindStr, BIND_PASSWORD, (err) => {
              if (called) return;
              called = true;
              if (err) return reject(err);
              resolve();
            });
            setTimeout(() => {
              if (!called) {
                called = true;
                reject(new Error("LDAP bind timeout"));
              }
            }, 5e3);
          });
          bound = true;
          break;
        } catch (err) {
          lastBindError = err;
        }
      }
      if (!bound) {
        client.removeListener("error", onClientError);
        try {
          client.unbind();
        } catch (e) {
        }
        securityLogger.warn("LDAP bind failed", {
          login,
          error: String(lastBindError),
          adminId: req.session?.adminId,
          ip: req.ip,
          userAgent: req.get("user-agent")
        });
        return res.status(500).json({ message: "LDAP bind failed", details: String(lastBindError) });
      }
      const q = escapeLdapFilter(login);
      const opts = {
        filter: `(|(sAMAccountName=${q})(userPrincipalName=${q})(cn=${q})(mail=${q}))`,
        scope: "sub",
        // request all user attributes to be robust against various AD schemas
        attributes: ["*"]
      };
      client.search(BASE_DN, opts, (err, ldapRes) => {
        if (err) {
          client.removeListener("error", onClientError);
          client.unbind();
          return res.status(500).json({ message: "LDAP search error", details: String(err) });
        }
        let user = null;
        ldapRes.on("searchEntry", (entry) => {
          try {
            if (entry && entry.object && Object.keys(entry.object).length) {
              user = entry.object;
              return;
            }
          } catch (e) {
          }
          if (entry && Array.isArray(entry.attributes) && entry.attributes.length) {
            const obj = {};
            for (const attr of entry.attributes) {
              try {
                const vals = attr && (attr.values || attr.vals || attr._vals) || attr;
                if (Array.isArray(vals) && vals.length === 1) obj[attr.type || attr.typeName || attr.attribute] = vals[0];
                else obj[attr.type || attr.typeName || attr.attribute] = vals;
              } catch (e) {
                obj[attr.type || attr.typeName || attr.attribute] = attr;
              }
            }
            user = obj;
            return;
          }
          try {
            import("node:util").then((util) => {
            }).catch(() => {
            });
          } catch (e) {
          }
          try {
            if (entry && typeof entry.toObject === "function") {
              user = entry.toObject();
            } else if (entry && typeof entry.toJSON === "function") {
              user = entry.toJSON();
            }
          } catch (e) {
          }
        });
        ldapRes.on("error", (err2) => {
          client.removeListener("error", onClientError);
          client.unbind();
          console.error("LDAP response error", err2);
          return res.status(500).json({ message: "LDAP response error", details: String(err2) });
        });
        ldapRes.on("end", () => {
          client.removeListener("error", onClientError);
          client.unbind();
          if (user) {
            return res.json(user);
          }
          return res.status(404).json({ message: "User not found" });
        });
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/admin/sync-ad", requireRole(["admin"]), async (_req, res) => {
    try {
      const LDAP_URL = process.env.LDAP_URL;
      const BIND_DN = process.env.LDAP_BIND_DN;
      const BIND_PASSWORD = process.env.LDAP_BIND_PASSWORD;
      const BASE_DN = process.env.LDAP_BASE_DN;
      const ldapConfigured = Boolean(LDAP_URL && BIND_DN && BIND_PASSWORD && BASE_DN);
      if (!ldapConfigured) {
        return res.status(500).json({ message: "LDAP \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D \u043D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435" });
      }
      const all = await storage.getAllLocations();
      const workLocations = all.filter((l) => (l.type === "workstation" || !l.type) && l.id);
      const results = [];
      const client = ldap2.createClient({ url: LDAP_URL });
      let clientErrored = false;
      const onClientError = (err) => {
        clientErrored = true;
      };
      client.on("error", onClientError);
      const candidates = [];
      if (BIND_DN) candidates.push(BIND_DN);
      let rdnName = null;
      try {
        if (BIND_DN && BIND_DN.includes(",")) {
          const first = BIND_DN.split(",")[0];
          if (first.includes("=")) rdnName = first.split("=")[1];
        }
      } catch (e) {
      }
      if (rdnName) candidates.push(rdnName);
      let domain = null;
      try {
        if (BASE_DN) {
          const parts = BASE_DN.split(",").map((p) => p.trim()).filter((p) => p.toUpperCase().startsWith("DC="));
          domain = parts.map((p) => p.split("=")[1]).join(".");
        }
      } catch (e) {
        domain = null;
      }
      if (rdnName && domain) candidates.push(`${rdnName}@${domain}`);
      let bound = false;
      let lastBindError = null;
      for (const bindStr of candidates) {
        if (!bindStr) continue;
        try {
          await new Promise((resolve, reject) => {
            let called = false;
            client.bind(bindStr, BIND_PASSWORD, (err) => {
              if (called) return;
              called = true;
              err ? reject(err) : resolve();
            });
            setTimeout(() => {
              if (!called) {
                called = true;
                reject(new Error("LDAP bind timeout"));
              }
            }, 5e3);
          });
          bound = true;
          break;
        } catch (err) {
          lastBindError = err;
        }
      }
      if (!bound) {
        client.removeListener("error", onClientError);
        try {
          client.unbind();
        } catch (e) {
        }
        securityLogger.warn("LDAP bind failed in users-sync endpoint", {
          error: String(lastBindError),
          adminId: _req.session?.adminId,
          ip: _req.ip,
          userAgent: _req.get("user-agent")
        });
        return res.status(500).json({ message: "LDAP bind failed", details: String(lastBindError) });
      }
      const searchByLogin = (login) => new Promise((resolve, reject) => {
        const q = escapeLdapFilter(login);
        const opts = { filter: `(|(sAMAccountName=${q})(userPrincipalName=${q})(cn=${q})(mail=${q}))`, scope: "sub", attributes: ["*"] };
        client.search(BASE_DN, opts, (err, ldapRes) => {
          if (err) return reject(err);
          let user = null;
          ldapRes.on("searchEntry", (entry) => {
            try {
              if (entry && entry.object && Object.keys(entry.object).length) {
                user = entry.object;
                return;
              }
            } catch {
            }
            if (entry && Array.isArray(entry.attributes) && entry.attributes.length) {
              const obj = {};
              for (const attr of entry.attributes) {
                try {
                  const vals = attr && (attr.values || attr.vals || attr._vals) || attr;
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
          ldapRes.on("error", (e) => reject(e));
          ldapRes.on("end", () => resolve(user));
        });
      });
      for (const loc of workLocations) {
        try {
          const employeeMarker = await storage.getMarker(loc.id, "employee");
          const login = employeeMarker?.value?.trim();
          if (!login) {
            results.push({ id: loc.id, status: "skipped", reason: "no employee marker" });
            continue;
          }
          const user = await searchByLogin(login);
          if (!user) {
            results.push({ id: loc.id, login, status: "not_found" });
            continue;
          }
          const current = await storage.getLocation(loc.id);
          const currentName = current?.name || "";
          const currentCF = current && current.customFields && typeof current.customFields === "object" ? { ...current.customFields } : {};
          const nameParts = [];
          if (user.cn) nameParts.push(user.cn);
          if (user.middleName) nameParts.push(user.middleName);
          const desiredName = nameParts.length ? nameParts.join(" ") : currentName || login;
          const desiredCF = { ...currentCF };
          if (user.department) desiredCF.department = user.department;
          if (user.title) desiredCF.position = user.title;
          if (user.mail) desiredCF.email = user.mail;
          if (user.extensionAttribute3) desiredCF.telegram = user.extensionAttribute3;
          if (user.mailNickname) desiredCF.logonCount = user.mailNickname;
          let photoBase64 = null;
          try {
            const q2 = escapeLdapFilter(login);
            const opts2 = { filter: `(|(sAMAccountName=${q2})(userPrincipalName=${q2})(cn=${q2})(mail=${q2}))`, scope: "sub", attributes: ["thumbnailPhoto"] };
            const photoBuffer = await new Promise((resolve, reject) => {
              let buf = null;
              client.search(BASE_DN, opts2, (err, ldapRes) => {
                if (err) return reject(err);
                ldapRes.on("searchEntry", (entry) => {
                  try {
                    if (entry && entry.raw && entry.raw.thumbnailPhoto && Buffer.isBuffer(entry.raw.thumbnailPhoto)) {
                      buf = entry.raw.thumbnailPhoto;
                      return;
                    }
                    if (Array.isArray(entry.attributes)) {
                      for (const attr of entry.attributes) {
                        const key = attr.type || attr.typeName || attr.attribute;
                        if (key === "thumbnailPhoto") {
                          const vals = attr && (attr.buffers || attr._vals || attr.values || attr.vals);
                          if (Array.isArray(vals) && vals[0] && Buffer.isBuffer(vals[0])) {
                            buf = vals[0];
                            break;
                          }
                          if (Buffer.isBuffer(vals)) {
                            buf = vals;
                            break;
                          }
                        }
                      }
                    }
                  } catch {
                  }
                });
                ldapRes.on("error", (e) => reject(e));
                ldapRes.on("end", () => resolve(buf));
              });
            });
            if (photoBuffer) {
              photoBase64 = photoBuffer.toString("base64");
            }
          } catch (e) {
          }
          let didChange = false;
          if (desiredName !== currentName) didChange = true;
          const cfSame = JSON.stringify(desiredCF || {}) === JSON.stringify(currentCF || {});
          if (!cfSame) didChange = true;
          if (photoBase64) {
            const existingThumb = currentCF?.thumbnailPhoto || null;
            if (!existingThumb || existingThumb !== photoBase64) {
              didChange = true;
            }
          }
          if (!didChange) {
            results.push({ id: loc.id, login, status: "skipped", reason: "no changes" });
            continue;
          }
          try {
            const updatePayload = { id: loc.id };
            if (desiredName !== currentName) updatePayload.name = desiredName;
            updatePayload.customFields = { ...desiredCF };
            if (photoBase64) {
              updatePayload.customFields.thumbnailPhoto = photoBase64;
              try {
                const mimeType = "image/jpeg";
                updatePayload.customFields.avatar = `data:${mimeType};base64,${photoBase64}`;
              } catch {
              }
            }
            await storage.updateLocation(updatePayload);
          } catch (e) {
          }
          if (photoBase64) {
            try {
              const existing = await storage.getAvatarByLocation(loc.id);
              const currentThumb = currentCF?.thumbnailPhoto || null;
              if (!currentThumb || currentThumb !== photoBase64) {
                try {
                  if (existing) await storage.deleteAvatar(existing.id);
                } catch {
                }
                const base64 = photoBase64;
                const originalName = `${login}.jpg`;
                const mimeType = "image/jpeg";
                const size = Buffer.from(base64, "base64").length;
                await storage.createAvatar({ locationId: loc.id, originalName, mimeType, size, data: base64 });
                try {
                  const cur2 = await storage.getLocation(loc.id);
                  if (cur2) {
                    const existingCF2 = cur2.customFields || {};
                    const dataUrl = `data:image/jpeg;base64,${base64}`;
                    const updatedCF2 = { ...existingCF2, avatar: dataUrl, thumbnailPhoto: base64 };
                    await storage.updateLocation({ id: cur2.id, customFields: updatedCF2 });
                  }
                } catch (e) {
                }
              }
            } catch (e) {
            }
          }
          try {
            broadcast({ type: "LOCATION_UPDATED", location: await storage.getLocation(loc.id) });
          } catch {
          }
          results.push({ id: loc.id, login, status: "updated" });
        } catch (e) {
          results.push({ id: loc.id, status: "error", reason: String(e?.message || e) });
        }
      }
      client.removeListener("error", onClientError);
      try {
        client.unbind();
      } catch {
      }
      return res.json({ success: true, updated: results.filter((r) => r.status === "updated").length, details: results });
    } catch (error) {
      return res.status(500).json({ message: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044E" });
    }
  });
  app2.post("/api/admin/locations/:locationId/avatar-from-ad", requireRole(["admin"]), async (req, res) => {
    try {
      const login = String(req.query.login || req.body.login || "").trim();
      if (!login) return res.status(400).json({ message: "login required" });
      const LDAP_URL = process.env.LDAP_URL;
      const BIND_DN = process.env.LDAP_BIND_DN;
      const BIND_PASSWORD = process.env.LDAP_BIND_PASSWORD;
      const BASE_DN = process.env.LDAP_BASE_DN;
      if (!LDAP_URL || !BIND_DN || !BIND_PASSWORD || !BASE_DN) {
        return res.status(500).json({ message: "LDAP is not configured on server" });
      }
      const client = ldap2.createClient({ url: LDAP_URL });
      let clientErrored = false;
      const onClientError = (err) => {
        clientErrored = true;
      };
      client.on("error", onClientError);
      const candidates = [];
      if (BIND_DN) candidates.push(BIND_DN);
      let rdnName = null;
      try {
        if (BIND_DN && BIND_DN.includes(",")) {
          const first = BIND_DN.split(",")[0];
          if (first.includes("=")) rdnName = first.split("=")[1];
        }
      } catch (e) {
      }
      if (rdnName) candidates.push(rdnName);
      let domain = null;
      try {
        if (BASE_DN) {
          const parts = BASE_DN.split(",").map((p) => p.trim()).filter((p) => p.toUpperCase().startsWith("DC="));
          domain = parts.map((p) => p.split("=")[1]).join(".");
        }
      } catch (e) {
        domain = null;
      }
      if (rdnName && domain) candidates.push(`${rdnName}@${domain}`);
      let bound = false;
      let lastBindError = null;
      for (const bindStr of candidates) {
        if (!bindStr) continue;
        try {
          await new Promise((resolve, reject) => {
            let called = false;
            client.bind(bindStr, BIND_PASSWORD, (err) => {
              if (called) return;
              called = true;
              if (err) return reject(err);
              resolve();
            });
            setTimeout(() => {
              if (!called) {
                called = true;
                reject(new Error("LDAP bind timeout"));
              }
            }, 5e3);
          });
          bound = true;
          break;
        } catch (err) {
          lastBindError = err;
        }
      }
      if (!bound) {
        client.removeListener("error", onClientError);
        try {
          client.unbind();
        } catch (e) {
        }
        securityLogger.warn("LDAP bind failed in avatar-ad endpoint", {
          login,
          error: String(lastBindError),
          adminId: req.session?.adminId,
          ip: req.ip,
          userAgent: req.get("user-agent")
        });
        return res.status(500).json({ message: "LDAP bind failed", details: String(lastBindError) });
      }
      const q = escapeLdapFilter(login);
      const opts = {
        filter: `(|(sAMAccountName=${q})(userPrincipalName=${q})(cn=${q})(mail=${q}))`,
        scope: "sub",
        attributes: ["thumbnailPhoto"]
      };
      client.search(BASE_DN, opts, (err, ldapRes) => {
        if (err) {
          client.removeListener("error", onClientError);
          client.unbind();
          return res.status(500).json({ message: "LDAP search error", details: String(err) });
        }
        let photoBuffer = null;
        ldapRes.on("searchEntry", (entry) => {
          try {
            if (entry && entry.raw && entry.raw.thumbnailPhoto) {
              const val = entry.raw.thumbnailPhoto;
              if (Buffer.isBuffer(val)) photoBuffer = val;
            }
            if (!photoBuffer && Array.isArray(entry.attributes)) {
              for (const attr of entry.attributes) {
                if ((attr.type || attr.typeName || attr.attribute) === "thumbnailPhoto") {
                  const vals = attr && (attr.buffers || attr._vals || attr.values || attr.vals);
                  if (Array.isArray(vals) && vals[0] && Buffer.isBuffer(vals[0])) {
                    photoBuffer = vals[0];
                    break;
                  }
                  if (Buffer.isBuffer(vals)) {
                    photoBuffer = vals;
                    break;
                  }
                }
              }
            }
          } catch (e) {
          }
        });
        ldapRes.on("error", (err2) => {
          client.removeListener("error", onClientError);
          client.unbind();
          return res.status(500).json({ message: "LDAP response error", details: String(err2) });
        });
        ldapRes.on("end", async () => {
          client.removeListener("error", onClientError);
          client.unbind();
          if (!photoBuffer) {
            return res.status(404).json({ message: "thumbnailPhoto not found for user" });
          }
          try {
            const existing = await storage.getAvatarByLocation(req.params.locationId);
            if (existing) {
              await storage.deleteAvatar(existing.id);
            }
            const base64 = photoBuffer.toString("base64");
            const originalName = `${login}.jpg`;
            const mimeType = "image/jpeg";
            const size = photoBuffer.length;
            const avatar = await storage.createAvatar({ locationId: req.params.locationId, originalName, mimeType, size, data: base64 });
            try {
              const location = await storage.getLocation(req.params.locationId);
              if (location) {
                const existingCF = location.customFields || {};
                const dataUrl = `data:${mimeType};base64,${base64}`;
                const updatedCF = { ...existingCF, avatar: dataUrl, thumbnailPhoto: base64 };
                await storage.updateLocation({ id: location.id, customFields: updatedCF });
                const updatedLocation = await storage.getLocation(req.params.locationId);
                if (updatedLocation) broadcast({ type: "LOCATION_UPDATED", location: updatedLocation });
              }
            } catch (e) {
            }
            return res.status(201).json(avatar);
          } catch (e) {
            return res.status(500).json({ message: "Failed to save avatar", details: String(e) });
          }
        });
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  const crtDir = path4.resolve(__dirname4, "..", "crt");
  let httpServer;
  try {
    const pfxPath = path4.join(crtDir, "map.spectrum.int.pfx");
    const keyPath = path4.join(crtDir, "map.spectrum.int.key");
    const certPath = path4.join(crtDir, "map.spectrum.int.crt");
    if (fs2.existsSync(pfxPath)) {
      try {
        const pfx = fs2.readFileSync(pfxPath);
        const passphrase = process.env.SSL_PFX_PASSPHRASE || void 0;
        httpServer = https.createServer({ pfx, passphrase }, app2);
      } catch (e) {
      }
    } else if (fs2.existsSync(keyPath) && fs2.existsSync(certPath)) {
      try {
        const key = fs2.readFileSync(keyPath);
        const cert = fs2.readFileSync(certPath);
        httpServer = https.createServer({ key, cert }, app2);
      } catch (e) {
      }
    }
  } catch (e) {
  }
  if (!httpServer) {
    httpServer = createHttpServer(app2);
  }
  const websocketsEnabled = process.env.WEBSOCKETS_ENABLED !== "false";
  if (websocketsEnabled) {
    try {
      const wss = new WebSocketServer({
        server: httpServer,
        path: "/ws",
        verifyClient: ({ req }, done) => {
          done(true);
        }
      });
      wss.on("connection", (ws, req) => {
        wsClients.add(ws);
        ws.on("close", () => {
          wsClients.delete(ws);
        });
        ws.on("error", (error) => {
          wsClients.delete(ws);
        });
      });
    } catch (error) {
    }
  }
  try {
    adSyncScheduler.start();
  } catch (error) {
    console.error("Failed to start AD Sync Scheduler:", error);
  }
  try {
    socketPortScheduler.setBroadcastFn(broadcast);
    socketPortScheduler.start();
    const spsStatus = socketPortScheduler.getStatus();
    console.log(`Socket Port Scheduler started with ${Math.round(spsStatus.intervalMs / 6e4)}-minute batch intervals, batchSize=${spsStatus.batchSize}`);
  } catch (error) {
    console.error("Failed to start Socket Port Scheduler:", error);
  }
  return httpServer;
}
var __dirname4, securityLogger;
var init_routes = __esm({
  "server/routes.ts"() {
    "use strict";
    init_storage();
    init_schema();
    init_ad_sync_scheduler();
    init_socket_port_scheduler();
    init_cisco_port_status();
    __dirname4 = path4.dirname(fileURLToPath4(import.meta.url));
    securityLogger = winston3.createLogger({
      level: "info",
      format: winston3.format.combine(
        winston3.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston3.format.errors({ stack: true }),
        winston3.format.json()
      ),
      defaultMeta: { service: "office-map" },
      transports: [
        // Error log file
        new winston3.transports.File({
          filename: "logs/security-error.log",
          level: "error",
          maxsize: 5242880,
          // 5MB
          maxFiles: 5
        }),
        // All security events
        new winston3.transports.File({
          filename: "logs/security.log",
          maxsize: 5242880,
          // 5MB
          maxFiles: 5
        })
      ]
    });
    if (process.env.NODE_ENV !== "production") {
      securityLogger.add(new winston3.transports.Console({
        format: winston3.format.combine(
          winston3.format.colorize(),
          winston3.format.printf(({ timestamp: timestamp2, level, message, ...meta }) => {
            return `${timestamp2} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""}`;
          })
        )
      }));
    }
    if (!fs2.existsSync("logs")) {
      fs2.mkdirSync("logs", { recursive: true });
    }
  }
});

// server/index.ts
import express3 from "express";
import path5 from "path";
import { fileURLToPath as fileURLToPath5 } from "url";
import fs3 from "fs";
import os from "os";
import dotenv2 from "dotenv";

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay()
    // Cartographer plugin excluded - not needed for local development
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    },
    proxy: {
      "/ws": {
        target: "ws://localhost:5000",
        ws: true,
        secure: false,
        changeOrigin: true
      },
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true
      }
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __dirname2 = path2.dirname(fileURLToPath2(import.meta.url));
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var __dirname5 = path5.dirname(fileURLToPath5(import.meta.url));
var projectEnvPath = path5.resolve(__dirname5, "..", ".env");
var userEnvDir = "C:\\Users\\sedyh.a\\Desktop\\1";
var legacyEnvPath = path5.resolve(userEnvDir, ".env");
var dotenvPath = function() {
  if (process.env.DOTENV_PATH && fs3.existsSync(process.env.DOTENV_PATH)) return process.env.DOTENV_PATH;
  if (fs3.existsSync(legacyEnvPath)) return legacyEnvPath;
  if (fs3.existsSync(projectEnvPath)) return projectEnvPath;
  return legacyEnvPath;
}();
dotenv2.config({ path: dotenvPath });
var app = express3();
app.use(express3.json({ limit: "10mb" }));
app.use(express3.urlencoded({ extended: false, limit: "10mb" }));
(async () => {
  const { registerRoutes: registerRoutes2 } = await Promise.resolve().then(() => (init_routes(), routes_exports));
  const server = await registerRoutes2(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const crtDir = path5.resolve(__dirname5, "..", "crt");
  const pfxPath = path5.join(crtDir, "map.spectrum.int.pfx");
  const keyPath = path5.join(crtDir, "map.spectrum.int.key");
  const certPath = path5.join(crtDir, "map.spectrum.int.crt");
  const hasLocalCerts = (() => {
    try {
      return fs3.existsSync(pfxPath) || fs3.existsSync(keyPath) && fs3.existsSync(certPath);
    } catch {
      return false;
    }
  })();
  const defaultPort = hasLocalCerts ? "443" : "5000";
  const port = parseInt(process.env.PORT || defaultPort, 10);
  if (hasLocalCerts) {
    const redirectApp = express3();
    redirectApp.all("*", (req, res) => {
      const host = req.get("host")?.split(":")[0] || "map.spectrum.int";
      res.redirect(301, `https://${host}:${port}${req.url}`);
    });
    redirectApp.listen(3e3, "0.0.0.0", () => {
      log("HTTP \u2192 HTTPS redirection enabled on port 3000");
    });
  }
  server.listen(port, "0.0.0.0", () => {
    const crtDir2 = path5.resolve(__dirname5, "..", "crt");
    const pfxPath2 = path5.join(crtDir2, "map.spectrum.int.pfx");
    const keyPath2 = path5.join(crtDir2, "map.spectrum.int.key");
    const certPath2 = path5.join(crtDir2, "map.spectrum.int.crt");
    const isHttps = (() => {
      try {
        return fs3.existsSync(pfxPath2) || fs3.existsSync(keyPath2) && fs3.existsSync(certPath2);
      } catch {
        return false;
      }
    })();
    const protocol = isHttps ? "https" : "http";
    const ifaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(ifaces)) {
      const nets = ifaces[name] || [];
      for (const net of nets) {
        if (net.family === "IPv4" && !net.internal) {
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
