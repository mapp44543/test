import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initAdmins() {
  try {
    // Проверяем наличие переменных окружения
    const adminPasswordEnv = process.env.ADMIN_PASSWORD;
    const hrPasswordEnv = process.env.HR_PASSWORD;

    if (!adminPasswordEnv) {
      throw new Error('Missing required env variable: ADMIN_PASSWORD');
    }
    if (!hrPasswordEnv) {
      throw new Error('Missing required env variable: HR_PASSWORD');
    }

    // Hash пароли из переменных окружения
    const adminPassword = await bcrypt.hash(adminPasswordEnv, 10);
    const hrPassword = await bcrypt.hash(hrPasswordEnv, 10);

    console.log('Clearing existing admins...');
    // Удаляем существующих админов
    await pool.query('DELETE FROM admins');

    console.log('Creating admin users...');
    // Создаём admin
    await pool.query(
      'INSERT INTO admins (username, password, role) VALUES ($1, $2, $3)',
      ['admin', adminPassword, 'admin']
    );

    // Создаём HR
    await pool.query(
      'INSERT INTO admins (username, password, role) VALUES ($1, $2, $3)',
      ['HR', hrPassword, 'hr']
    );

    console.log('✓ Admins created successfully:');
    console.log('  - admin (role: admin)');
    console.log('  - HR (role: hr)');

  } catch (error) {
    console.error('Error initializing admins:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

initAdmins().catch(console.error);
