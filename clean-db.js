import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanDatabase() {
  try {
    console.log('Dropping old tables...');
    await pool.query('DROP TABLE IF EXISTS markers CASCADE');
    await pool.query('DROP TABLE IF EXISTS avatars CASCADE');
    await pool.query('DROP TABLE IF EXISTS locations CASCADE');
    await pool.query('DROP TABLE IF EXISTS floors CASCADE');
    await pool.query('DROP TABLE IF EXISTS sessions CASCADE');
    await pool.query('DROP TABLE IF EXISTS admins CASCADE');
    await pool.query('DROP TABLE IF EXISTS public_links CASCADE');
    console.log('All tables dropped successfully');
  } catch (error) {
    console.error('Error dropping tables:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

cleanDatabase().catch(console.error);
