/**
 * Migration script to rename icon references from Russian to English names
 * Run with: npx tsx rename-icons.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { locations } from "./shared/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// Mapping of old Russian names to new English names
const iconRenameMap: Record<string, string> = {
  "сотрудник.svg": "employee.svg",
  "сотрудник с охранным полем.svg": "employee-secure.svg",
  "раб место свободное.svg": "workstation-free.svg",
  "раб место свободное с охранным полем.svg": "workstation-free-secure.svg",
  "Рабочее место в работах.svg": "workstation-repair.svg",
  "Рабочее место в работах с охранным полем.svg": "workstation-repair-secure.svg",
};

async function renameIcons() {
  try {
    console.log("🔄 Starting icon rename migration...");

    // Get all workstations with custom icons
    const result = await db
      .select()
      .from(locations)
      .where(eq(locations.type, "workstation"));

    console.log(`Found ${result.length} workstation locations`);

    let updated = 0;

    // Update each location with old icon names
    for (const location of result) {
      const customFields = (location.customFields as Record<string, any>) || {};
      const currentIcon = customFields.customIcon;

      if (currentIcon && iconRenameMap[currentIcon]) {
        const newIcon = iconRenameMap[currentIcon];
        console.log(
          `✏️  "${location.name}" (${location.id}): ${currentIcon} → ${newIcon}`
        );

        // Update the location with new icon name
        const updatedFields = {
          ...customFields,
          customIcon: newIcon,
        };

        // Use raw SQL update since drizzle's update might not handle JSONB properly
        await pool.query(
          `UPDATE locations SET custom_fields = $1 WHERE id = $2`,
          [JSON.stringify(updatedFields), location.id]
        );

        updated++;
      }
    }

    console.log(`\n✅ Successfully updated ${updated} locations`);
  } catch (error) {
    console.error("❌ Error during migration:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

renameIcons();
