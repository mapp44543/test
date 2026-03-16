import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Загружаем .env из корневой папки проекта
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigrations() {
  try {
    console.log('Scanning migrations directory...');

    const files = await fs.promises.readdir(__dirname);
    const sqlFiles = files
      .filter((f) => f.endsWith('.sql'))
      .sort(); // Применяем в алфавитном/лексикографическом порядке (0001, 0002, ...)

    if (sqlFiles.length === 0) {
      console.log('No SQL migrations found.');
      return;
    }

    console.log('Applying migrations:', sqlFiles);

    for (const file of sqlFiles) {
      const fullPath = path.join(__dirname, file);
      console.log(`- Applying ${file}...`);
      const sql = await fs.promises.readFile(fullPath, 'utf-8');
      await pool.query(sql);
      console.log(`  -> ${file} applied`);
    }

    console.log('All migrations applied successfully');
  } catch (error) {
    console.error('Error applying migrations:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

applyMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});