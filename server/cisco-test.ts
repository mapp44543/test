import { Client } from 'ssh2';
import dotenv from 'dotenv';
dotenv.config();

async function testCiscoConnection() {
  const host = process.env.HOST_5;
  const username = process.env.CISCO_USER_5;
  const password = process.env.PASSWORD_5;

  console.log('Testing connection to:', host);

  return new Promise((resolve, reject) => {
    const conn = new Client();
    
    conn.on('ready', () => {
      console.log('SSH Connection successful!');
      conn.end();
      resolve(true);
    }).on('error', (err) => {
      console.error('SSH Connection failed:', err.message);
      reject(err);
    }).connect({
      host,
      username,
      password,
      port: 22,
      debug: (message: string) => console.log('SSH Debug:', message),
      readyTimeout: 5000, // 5 секунд таймаут
    });
  });
}

testCiscoConnection().catch(console.error);