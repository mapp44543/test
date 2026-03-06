import {
  admins,
  locations,
  floors,
  markers,
  avatars,
  publicLinks,
  type Admin,
  type InsertAdmin,
  type Floor,
  type InsertFloor,
  type Location,
  type InsertLocation,
  type UpdateLocation,
  type Marker,
  type InsertMarker,
  type UpdateMarker,
  type Avatar,
  type InsertAvatar,
  type UpdateAvatar,
  type PublicLink,
  type InsertPublicLink,
  type UpdatePublicLink,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, type SQL } from "drizzle-orm";

export interface IStorage {
  // Admin operations
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  getAdminById(id: string): Promise<Admin | undefined>;
  updateAdminPassword(username: string, hashedPassword: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  
  // Floor operations
  getFloors(): Promise<Floor[]>;
  getFloorByCode(code: string): Promise<Floor | undefined>;
  createFloor(floor: InsertFloor): Promise<Floor>;
  updateFloor(id: string, floor: Partial<InsertFloor>): Promise<Floor>;
  // Update sort order for multiple floors in one operation (ids in desired order)
  updateFloorsOrder(ids: string[]): Promise<void>;
  deleteFloor(id: string): Promise<void>;

  // Location operations
  getAllLocations(): Promise<Location[]>;
  getLocationsByFloor(floor: string): Promise<Location[]>;
  getLocation(id: string): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(location: UpdateLocation): Promise<Location>;
  deleteLocation(id: string): Promise<void>;

  // Marker operations
  getMarkersByLocation(locationId: string): Promise<Marker[]>;
  getMarker(locationId: string, key: string): Promise<Marker | undefined>;
  createMarker(marker: InsertMarker): Promise<Marker>;
  updateMarker(marker: UpdateMarker): Promise<Marker>;
  deleteMarker(id: string): Promise<void>;
  deleteMarkersByLocation(locationId: string): Promise<void>;

  // Avatar operations
  getAvatar(id: string): Promise<Avatar | undefined>;
  getAvatarByLocation(locationId: string): Promise<Avatar | undefined>;
  createAvatar(avatar: InsertAvatar): Promise<Avatar>;
  updateAvatar(avatar: UpdateAvatar): Promise<Avatar>;
  deleteAvatar(id: string): Promise<void>;
  deleteAvatarByLocation(locationId: string): Promise<void>;

  // Public links operations
  getPublicLinks(): Promise<PublicLink[]>;
  getPublicLink(id: string): Promise<PublicLink | undefined>;
  createPublicLink(link: InsertPublicLink): Promise<PublicLink>;
  updatePublicLink(link: UpdatePublicLink): Promise<PublicLink>;
  deletePublicLink(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Admin operations
  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.username, username));
    return admin;
  }

  async getAdminById(id: string): Promise<Admin | undefined> {
    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.id, id))
      .limit(1);
    return admin;
  }

  async updateAdminPassword(username: string, hashedPassword: string): Promise<Admin | undefined> {
    const [admin] = await db
      .update(admins)
      .set({ password: hashedPassword })
      .where(eq(admins.username, username))
      .returning();
    return admin;
  }

  async createAdmin(insertAdmin: InsertAdmin): Promise<Admin> {
    const [admin] = await db
      .insert(admins)
      .values(insertAdmin)
      .returning();
    return admin;
  }

  // Floor operations
  async getFloors(): Promise<Floor[]> {
    return await db.select().from(floors).orderBy(floors.sortOrder);
  }

  async getFloorByCode(code: string): Promise<Floor | undefined> {
    const [floor] = await db.select().from(floors).where(eq(floors.code, code)).limit(1);
    return floor;
  }

  async createFloor(insertFloor: InsertFloor): Promise<Floor> {
    const [floor] = await db
      .insert(floors)
      .values(insertFloor)
      .returning();
    return floor;
  }

  async updateFloor(id: string, updateData: Partial<InsertFloor>): Promise<Floor> {
    console.log('storage.updateFloor - input:', { id, updateData });
    const [floor] = await db
      .update(floors)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(floors.id, id))
      .returning();
    console.log('storage.updateFloor - result:', floor);
    return floor;
  }

  async updateFloorsOrder(ids: string[]): Promise<void> {
    // Use a transaction to update sort_order for multiple floors atomically
    console.log('updateFloorsOrder called with ids:', ids);
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        console.log(` - updating ${ids[i]} => sortOrder=${i}`);
        await tx.update(floors).set({ sortOrder: i, updatedAt: new Date() }).where(eq(floors.id, ids[i]));
      }
    });
    console.log('updateFloorsOrder completed');
  }

  async deleteFloor(id: string): Promise<void> {
    await db.delete(floors).where(eq(floors.id, id));
  }

  // Location operations
  async getAllLocations(): Promise<Location[]> {
    return await db.select().from(locations);
  }

  async getLocationsByFloor(floor: string): Promise<Location[]> {
    return await db.select().from(locations).where(eq(locations.floor, floor));
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location;
  }

  async createLocation(insertLocation: InsertLocation): Promise<Location> {
    const { customFields, ...rest } = insertLocation;
    const [location] = await db
      .insert(locations)
      .values({
        ...rest,
        customFields: sql`${JSON.stringify(customFields || {})}::jsonb` as any,
        updatedAt: new Date(),
      })
      .returning();
    return location;
  }

  async updateLocation(updateLocation: UpdateLocation): Promise<Location> {
    const { id, customFields, ...updateData } = updateLocation;
    const updateSet: any = {
      ...updateData,
      updatedAt: new Date(),
    };
    if (customFields !== undefined) {
      updateSet.customFields = sql`${JSON.stringify(customFields)}::jsonb` as any;
    }
    const [location] = await db
      .update(locations)
      .set(updateSet)
      .where(eq(locations.id, id))
      .returning();
    return location;
  }

  async deleteLocation(id: string): Promise<void> {
    await db.delete(locations).where(eq(locations.id, id));
  }

  // Marker operations
  async getMarkersByLocation(locationId: string): Promise<Marker[]> {
    return await db
      .select()
      .from(markers)
      .where(eq(markers.locationId, locationId));
  }

  async getMarker(id: string): Promise<Marker | undefined>;
  async getMarker(locationId: string, key: string): Promise<Marker | undefined>;
  async getMarker(idOrLocationId: string, key?: string): Promise<Marker | undefined> {
    if (key === undefined) {
      // Поиск по id
      const [marker] = await db
        .select()
        .from(markers)
        .where(eq(markers.id, idOrLocationId))
        .limit(1);
      return marker;
    } else {
      // Поиск по locationId и key
      const [marker] = await db
        .select()
        .from(markers)
        .where(and(eq(markers.locationId, idOrLocationId), eq(markers.key, key)))
        .limit(1);
      return marker;
    }
  }

  async createMarker(insertMarker: InsertMarker): Promise<Marker> {
    const [marker] = await db
      .insert(markers)
      .values({
        ...insertMarker,
        updatedAt: new Date(),
      })
      .returning();
    return marker;
  }

  async updateMarker(updateMarker: UpdateMarker): Promise<Marker> {
    const { id, ...updateData } = updateMarker;
    const [marker] = await db
      .update(markers)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(markers.id, id))
      .returning();
    return marker;
  }

  async deleteMarker(id: string): Promise<void> {
    await db.delete(markers).where(eq(markers.id, id));
  }

  async deleteMarkersByLocation(locationId: string): Promise<void> {
    await db.delete(markers).where(eq(markers.locationId, locationId));
  }

  // Avatar operations
  async getAvatar(id: string): Promise<Avatar | undefined> {
    const [avatar] = await db
      .select()
      .from(avatars)
      .where(eq(avatars.id, id))
      .limit(1);
    return avatar;
  }

  async getAvatarByLocation(locationId: string): Promise<Avatar | undefined> {
    const [avatar] = await db
      .select()
      .from(avatars)
      .where(eq(avatars.locationId, locationId))
      .limit(1);
    return avatar;
  }

  async createAvatar(insertAvatar: InsertAvatar): Promise<Avatar> {
    const [avatar] = await db
      .insert(avatars)
      .values({
        ...insertAvatar,
        updatedAt: new Date(),
      })
      .returning();
    return avatar;
  }

  async updateAvatar(updateAvatar: UpdateAvatar): Promise<Avatar> {
    const { id, ...updateData } = updateAvatar;
    const [avatar] = await db
      .update(avatars)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(avatars.id, id))
      .returning();
    return avatar;
  }

  async deleteAvatar(id: string): Promise<void> {
    await db.delete(avatars).where(eq(avatars.id, id));
  }

  async deleteAvatarByLocation(locationId: string): Promise<void> {
    await db.delete(avatars).where(eq(avatars.locationId, locationId));
  }

  // Public links operations
  async getPublicLinks(): Promise<PublicLink[]> {
    return await db.select().from(publicLinks).orderBy(publicLinks.sortOrder);
  }

  async getPublicLink(id: string): Promise<PublicLink | undefined> {
    const [link] = await db
      .select()
      .from(publicLinks)
      .where(eq(publicLinks.id, id))
      .limit(1);
    return link;
  }

  async createPublicLink(insertLink: InsertPublicLink): Promise<PublicLink> {
    const [link] = await db
      .insert(publicLinks)
      .values({
        ...insertLink,
        updatedAt: new Date(),
      })
      .returning();
    return link;
  }

  async updatePublicLink(updateLink: UpdatePublicLink): Promise<PublicLink> {
    const { id, ...updateData } = updateLink;
    const [link] = await db
      .update(publicLinks)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(publicLinks.id, id))
      .returning();
    return link;
  }

  async deletePublicLink(id: string): Promise<void> {
    await db.delete(publicLinks).where(eq(publicLinks.id, id));
  }
}

export const storage = new DatabaseStorage();
