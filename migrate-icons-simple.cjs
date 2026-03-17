#!/usr/bin/env node

const pg = require('pg');
require('dotenv').config();

const { Client } = pg;

const iconMappings = [
  { old: 'сотрудник.svg', new: 'employee.svg' },
  { old: 'сотрудник с охранным полем.svg', new: 'employee-secure.svg' },
  { old: 'раб место свободное.svg', new: 'workstation-free.svg' },
  { old: 'раб место свободное с охранным полем.svg', new: 'workstation-free-secure.svg' },
  { old: 'Рабочее место в работах.svg', new: 'workstation-repair.svg' },
  { old: 'Рабочее место в работах с охранным полем.svg', new: 'workstation-repair-secure.svg' },
];

async function migrate() {
  console.log('Starting icon migration...\n');

  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error('ERROR: DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: connStr });

  try {
    await client.connect();
    console.log('Connected to database');

    const countRes = await client.query('SELECT COUNT(*) as count FROM locations WHERE type = $1', ['workstation']);
    const count = parseInt(countRes.rows[0].count);
    console.log('Found ' + count + ' workstation locations\n');

    let totalUpdated = 0;

    for (const mapping of iconMappings) {
      const result = await client.query(
        'UPDATE locations SET custom_fields = jsonb_set(COALESCE(custom_fields, \'{}\'), \'{customIcon}\', $1) WHERE type = $2 AND custom_fields->>\'customIcon\' = $3',
        [JSON.stringify(mapping.new), 'workstation', mapping.old]
      );
      const rows = result.rowCount || 0;
      if (rows > 0) {
        console.log('Updated ' + rows + ' location(s): ' + mapping.old + ' -> ' + mapping.new);
        totalUpdated += rows;
      }
    }

    console.log('\nMigration complete! Updated ' + totalUpdated + ' total records.');

    const verifyRes = await client.query(
      'SELECT id, name, custom_fields->>\'customIcon\' as customIcon FROM locations WHERE type = $1 AND custom_fields->>\'customIcon\' IS NOT NULL ORDER BY name',
      ['workstation']
    );

    if (verifyRes.rows.length > 0) {
      console.log('\nLocations with custom icons:');
      verifyRes.rows.forEach(function(loc) {
        console.log('  - ' + loc.name + ' (ID: ' + loc.id + '): ' + loc.customIcon);
      });
    }

    await client.end();
  } catch (error) {
    console.error('ERROR:', error.message);
    try { await client.end(); } catch(e) {}
    process.exit(1);
  }
}

migrate();
