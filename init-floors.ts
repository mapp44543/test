import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initFloors() {
  try {
    console.log('Initializing default floors...');

    // Получаем существующие этажи
    const result = await pool.query('SELECT COUNT(*) as count FROM floors');
    const existingFloors = parseInt(result.rows[0].count);

    if (existingFloors > 0) {
      console.log(`✓ Floors already exist in database (${existingFloors} floors). Skipping initialization.`);
      return;
    }

    // Этажи по умолчанию
    const defaultFloors = [
      { code: '5', name: 'Этаж 5', sortOrder: 0 },
      { code: '9', name: 'Этаж 9', sortOrder: 1 },
      { code: 'МСК', name: 'Склад МСК', sortOrder: 2 },
    ];

    console.log('Creating default floors...');
    for (const floor of defaultFloors) {
      await pool.query(
        'INSERT INTO floors (code, name, sort_order, show_in_public) VALUES ($1, $2, $3, $4)',
        [floor.code, floor.name, floor.sortOrder, true]
      );
      console.log(`  ✓ Created floor: ${floor.name} (code: ${floor.code})`);
    }

    console.log('✓ Floors initialized successfully!');
    console.log('  - Этаж 5');
    console.log('  - Этаж 9');
    console.log('  - Склад МСК');
    console.log('\nYou can now upload floor plan images through the Admin panel.');
  } catch (error) {
    console.error('Failed to initialize floors:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initFloors();
