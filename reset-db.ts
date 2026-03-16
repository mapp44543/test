import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join('.', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function resetDb() {
  try {
    const queries = [
      'DROP TABLE IF EXISTS markers CASCADE',
      'DROP TABLE IF EXISTS avatars CASCADE',
      'DROP TABLE IF EXISTS locations CASCADE',
      'DROP TABLE IF EXISTS floors CASCADE',
      'DROP TABLE IF EXISTS sessions CASCADE',
      'DROP TABLE IF EXISTS admins CASCADE',
      'DROP TABLE IF EXISTS public_links CASCADE'
    ];
    for (const q of queries) {
      await pool.query(q);
    }
    console.log('All tables dropped');
  } finally {
    await pool.end();
  }
}

resetDb().catch(console.error);
