import { sql } from "drizzle-orm";
import { pgTable, varchar, text, integer, jsonb, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const admins = pgTable("admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").notNull().unique(),
  password: varchar("password").notNull(),
  role: varchar("role").notNull().default('admin'), // 'admin' | 'hr'
  createdAt: timestamp("created_at").defaultNow(),
});

// Floors table to manage office floors and their map images
export const floors = pgTable("floors", {
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
  updatedAt: timestamp("updated_at").defaultNow(),
});


export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  type: varchar("type").notNull(), // 'meeting-room', 'workstation', 'equipment', 'common-area', 'socket'
  status: varchar("status").notNull().default("available"), // 'available', 'occupied', 'maintenance'
  // customFields для socket может содержать { port: "Gi1/0/11" }
  floor: varchar("floor").notNull().default("5"), // '5', '9', 'МСК'
  capacity: integer("capacity"),
  equipment: text("equipment"),
  employee: varchar("employee"),
  inventoryId: varchar("inventory_id"),
  x: real("x").notNull(), // X coordinate on map
  y: real("y").notNull(), // Y coordinate on map
  width: real("width").notNull().default(80), // Width in pixels
  height: real("height").notNull().default(60), // Height in pixels
  customColor: varchar("custom_color"), // Color for common-area locations
  customFields: jsonb("custom_fields").default({}).notNull().$type<{ port?: string } & Record<string, any>>(), // JSON object for custom fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

export const avatars = pgTable("avatars", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  locationId: varchar("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  originalName: varchar("original_name").notNull(), // Оригинальное имя файла
  mimeType: varchar("mime_type").notNull(), // Тип файла (image/jpeg, image/png, etc)
  size: integer("size").notNull(), // Размер файла в байтах
  data: text("data").notNull(), // Base64-encoded изображение
  thumbnailData: text("thumbnail_data"), // Base64-encoded уменьшенная версия (опционально)
  width: integer("width"), // Ширина изображения в пикселях
  height: integer("height"), // Высота изображения в пикселях
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const markers = pgTable("markers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  locationId: varchar("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  key: varchar("key").notNull(), // например 'avatar', 'department', etc.
  value: text("value").notNull(), // хранит значение (для аватарок - base64 строка)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Таблица для хранения публичных ссылок
export const publicLinks = pgTable("public_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").default(0), // Для управления порядком отображения
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAdminSchema = createInsertSchema(admins).pick({
  username: true,
  password: true,
  role: true,
});

export const insertFloorSchema = createInsertSchema(floors).pick({
  code: true,
  name: true,
  imageUrl: true,
  mimeType: true,
  sortOrder: true,
  showInPublic: true,
});

export const insertLocationSchema = createInsertSchema(locations).pick({
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
  customFields: true,
});

export const updateLocationSchema = insertLocationSchema.partial().extend({
  id: z.string(),
});

export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Floor = typeof floors.$inferSelect;
export type InsertFloor = z.infer<typeof insertFloorSchema>;
export const insertMarkerSchema = createInsertSchema(markers).pick({
  locationId: true,
  key: true,
  value: true,
});

export const updateMarkerSchema = insertMarkerSchema.partial().extend({
  id: z.string(),
});

export const insertAvatarSchema = createInsertSchema(avatars).pick({
  locationId: true,
  originalName: true,
  mimeType: true,
  size: true,
  data: true,
  thumbnailData: true,
  width: true,
  height: true,
});

export const updateAvatarSchema = insertAvatarSchema.partial().extend({
  id: z.string(),
});

export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type UpdateLocation = z.infer<typeof updateLocationSchema>;
export type Marker = typeof markers.$inferSelect;
export type InsertMarker = z.infer<typeof insertMarkerSchema>;
export type UpdateMarker = z.infer<typeof updateMarkerSchema>;
export type Avatar = typeof avatars.$inferSelect;
export type InsertAvatar = z.infer<typeof insertAvatarSchema>;
export type UpdateAvatar = z.infer<typeof updateAvatarSchema>;

// Схемы для публичных ссылок
export const insertPublicLinkSchema = createInsertSchema(publicLinks).pick({
  title: true,
  url: true,
  sortOrder: true,
});

export const updatePublicLinkSchema = insertPublicLinkSchema.partial().extend({
  id: z.string(),
});

export type PublicLink = typeof publicLinks.$inferSelect;
export type InsertPublicLink = z.infer<typeof insertPublicLinkSchema>;
export type UpdatePublicLink = z.infer<typeof updatePublicLinkSchema>;
