#!/usr/bin/env node

/**
 * PostgreSQL Icon Migration Script
 * Updates all workstation icon references from Russian names to English names.
 * 
 * Usage on server after git pull:
 *   node migrate-icons.js
 */

const pg = require('pg');
require('dotenv').config();

const { Client } = pg;

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

  const client = new Client({
    connectionString: connectionString,
  });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Check if there are any workstation locations
    const countResult = await client.query(
      'SELECT COUNT(*) as count FROM locations WHERE type = $1',
      ['workstation']
    );

    const totalLocations = parseInt(countResult.rows[0].count);
    console.log(`Found ${totalLocations} workstation locations\n`);

    // Update each icon mapping
    let totalUpdated = 0;

    for (const mapping of iconMappings) {
      const result = await client.query(
        `UPDATE locations
         SET custom_fields = jsonb_set(
           COALESCE(custom_fields, '{}'::jsonb),
           '{customIcon}',
           to_jsonb($1::text)
         )
         WHERE type = $2
         AND custom_fields->>'customIcon' = $3`,
        [mapping.new, 'workstation', mapping.old]
      );

      const changedRows = result.rowCount || 0;
      if (changedRows > 0) {
        console.log(
          `✓ Updated ${changedRows} location(s): "${mapping.old}" → "${mapping.new}"`
        );
        totalUpdated += changedRows;
      }
    }

    console.log(`\n✅ Migration complete! Updated ${totalUpdated} total records.`);

    // Verify results
    const verifyResults = await client.query(
      `SELECT id, name, custom_fields->>'customIcon' as customIcon
       FROM locations
       WHERE type = $1
       AND custom_fields->>'customIcon' IS NOT NULL
       ORDER BY name`,
      ['workstation']
    );

    if (verifyResults.rows.length > 0) {
      console.log('\n📋 Locations with custom icons after migration:');
      verifyResults.rows.forEach((loc) => {
        console.log(`   - ${loc.name} (ID: ${loc.id}): ${loc.customIcon}`);
      });
    } else {
      console.log('\n📋 No workstation locations with custom icons found.');
    }

    await client.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    try {
      await client.end();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  }
}

migrateIcons();
