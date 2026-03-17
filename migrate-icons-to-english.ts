#!/usr/bin/env node

/**
 * Icon Migration Script
 * Updates all workstation icon references from Russian names to English names.
 * Run on server after git pull to update database: node migrate-icons-to-english.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Icon name mappings
const iconMappings = [
  {
    old: 'сотрудник.svg',
    new: 'employee.svg',
  },
  {
    old: 'сотрудник с охранным полем.svg',
    new: 'employee-secure.svg',
  },
  {
    old: 'раб место свободное.svg',
    new: 'workstation-free.svg',
  },
  {
    old: 'раб место свободное с охранным полем.svg',
    new: 'workstation-free-secure.svg',
  },
  {
    old: 'Рабочее место в работах.svg',
    new: 'workstation-repair.svg',
  },
  {
    old: 'Рабочее место в работах с охранным полем.svg',
    new: 'workstation-repair-secure.svg',
  },
];

async function migrateIcons() {
  console.log('🔄 Starting icon migration from Russian to English...\n');

  try {
    // Connect to database
    const dbPath = path.join(__dirname, 'storage.db');
    const db = new Database(dbPath);

    // Get workstation locations
    const getLocationsStmt = db.prepare(`
      SELECT id, name, custom_fields
      FROM locations
      WHERE type = 'workstation'
    `);

    const locations = getLocationsStmt.all() as Array<{
      id: string;
      name: string;
      custom_fields: string | null;
    }>;

    console.log(`Found ${locations.length} workstation locations\n`);

    // Update each icon mapping
    let totalUpdated = 0;

    for (const mapping of iconMappings) {
      const updateStmt = db.prepare(`
        UPDATE locations
        SET custom_fields = json_set(
          COALESCE(custom_fields, '{}'),
          '$.customIcon',
          ?
        )
        WHERE type = 'workstation'
        AND json_extract(custom_fields, '$.customIcon') = ?
      `);

      const result = updateStmt.run(mapping.new, mapping.old);

      if (result.changes > 0) {
        console.log(
          `✓ Updated ${result.changes} location(s): "${mapping.old}" → "${mapping.new}"`
        );
        totalUpdated += result.changes;
      }
    }

    console.log(`\n✅ Migration complete! Updated ${totalUpdated} total records.`);

    // Verify results
    const verifyLocations = db
      .prepare(
        `
      SELECT id, name, json_extract(custom_fields, '$.customIcon') as customIcon
      FROM locations
      WHERE type = 'workstation' AND json_extract(custom_fields, '$.customIcon') IS NOT NULL
    `
      )
      .all() as Array<{
      id: string;
      name: string;
      customIcon: string | null;
    }>;

    if (verifyLocations.length > 0) {
      console.log('\n📋 Locations with custom icons:');
      verifyLocations.forEach((loc) => {
        console.log(
          `   - ${loc.name} (ID: ${loc.id}): ${loc.customIcon}`
        );
      });
    }

    db.close();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateIcons();
