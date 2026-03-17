#!/usr/bin/env node

/**
 * PostgreSQL Icon Migration Script
 * Updates all workstation icon references from Russian names to English names.
 * 
 * Usage on server after git pull:
 *   npx ts-node migrate-icons-postgres.ts
 * 
 * Or with tsx:
 *   npx tsx migrate-icons-postgres.ts
 */

import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

// Icon name mappings: old Russian → new English
const iconMappings = [
  { old: 'сотрудник.svg', new: 'employee.svg' },
  { old: 'сотрудник с охранным полем.svg', new: 'employee-secure.svg' },
  { old: 'раб место свободное.svg', new: 'workstation-free.svg' },
  { old: 'раб место свободное с охранным полем.svg', new: 'workstation-free-secure.svg' },
  { old: 'Рабочее место в работах.svg', new: 'workstation-repair.svg' },
  { old: 'Рабочее место в работах с охранным полем.svg', new: 'workstation-repair-secure.svg' },
];

async function migrateIcons() {
  console.log('🔄 Starting PostgreSQL icon migration from Russian to English...\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(connectionString);

  try {
    // Check if there are any workstation locations
    const countResult = await client`
      SELECT COUNT(*) as count
      FROM locations
      WHERE type = 'workstation'
    `;

    const totalLocations = (countResult[0] as any).count;
    console.log(`Found ${totalLocations} workstation locations\n`);

    // Update each icon mapping
    let totalUpdated = 0;

    for (const mapping of iconMappings) {
      const result = await client`
        UPDATE locations
        SET custom_fields = jsonb_set(
          COALESCE(custom_fields, '{}'::jsonb),
          '{customIcon}',
          to_jsonb(${mapping.new}::text)
        )
        WHERE type = 'workstation'
        AND custom_fields->>'customIcon' = ${mapping.old}
      `;

      const changedRows = (result as any).count || result.length || 0;
      if (changedRows > 0) {
        console.log(
          `✓ Updated ${changedRows} location(s): "${mapping.old}" → "${mapping.new}"`
        );
        totalUpdated += changedRows;
      }
    }

    console.log(`\n✅ Migration complete! Updated ${totalUpdated} total records.`);

    // Verify results
    const verifyResults = await client`
      SELECT id, name, custom_fields->>'customIcon' as customIcon
      FROM locations
      WHERE type = 'workstation'
      AND custom_fields->>'customIcon' IS NOT NULL
      ORDER BY name
    `;

    if (verifyResults.length > 0) {
      console.log('\n📋 Locations with custom icons after migration:');
      verifyResults.forEach((loc: any) => {
        console.log(`   - ${loc.name} (ID: ${loc.id}): ${loc.customIcon}`);
      });
    }

    await client.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await client.end();
    process.exit(1);
  }
}

migrateIcons();
