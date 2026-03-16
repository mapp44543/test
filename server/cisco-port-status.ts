import { Client } from 'ssh2';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Request, Response } from 'express';

// Настраиваем путь к .env файлу относительно текущего файла
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath, debug: true });

// Получить статус порта Cisco
// Helper: fetch and parse Cisco port info for given port number.
export async function fetchCiscoPortInfo(portInput: string, site?: string): Promise<any> {
  let port = String(portInput || '').trim();
  if (!port) throw new Error('Port is required');
  port = port.replace(/^(Gi\d\/\d\/|Fa\d\/\d\/)?(\d+)$/i, '$2');

  // Determine which device credentials to use. Default to floor 5 for backward compatibility.
  let siteKey = (String(site || '').trim() || '5').toLowerCase();
  // Normalize common aliases (accept Cyrillic 'мск' and common variants)
  const siteAliases: Record<string, string> = { 'мск': 'msk', 'москва': 'msk', 'moscow': 'msk', 'msk': 'msk' };
  siteKey = siteAliases[siteKey] || siteKey;

  const envMap: Record<string, { host: string; user: string; pass: string }> = {
    '5': { host: 'HOST_5', user: 'CISCO_USER_5', pass: 'PASSWORD_5' },
    '9': { host: 'HOST_9', user: 'CISCO_USER_9', pass: 'PASSWORD_9' },
    'msk': { host: 'HOST_MSK', user: 'CISCO_USER_MSK', pass: 'PASSWORD_MSK' },
  }; 

  const selected = envMap[siteKey] || envMap['5'];
  const host = process.env[selected.host];
  const username = process.env[selected.user] || process.env.CISCO_USER_5 || process.env['CISCO_USER_5'];
  const password = process.env[selected.pass] || process.env.PASSWORD_5 || process.env['PASSWORD_5'];

  console.log(`[${new Date().toISOString()}] Attempting to connect to Cisco switch at ${host} for port ${port}`);

  const missing: string[] = [];
  if (!host) missing.push(selected.host);
  if (!username) missing.push(selected.user);
  if (!password) missing.push(selected.pass);

  if (missing.length) {
    const err: any = new Error(`Missing environment variables: ${missing.join(', ')}`);
    err.details = Object.fromEntries(missing.map(k => [k, process.env[k] ? '***' : undefined]));
    throw err;
  }

  return await new Promise((resolve, reject) => {
    const conn = new Client();
    let result = '';
    let finished = false;

    const operationTimeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        try { conn.end(); } catch (e) {}
        reject(new Error('Operation timeout: no response from switch'));
      }
    }, 10000);

    conn.on('ready', () => {
      console.log(`[${new Date().toISOString()}] SSH connection established, executing command for port ${port}`);
    conn.exec(`show interface GigabitEthernet1/0/${port} status`, (err: Error | undefined, stream: any) => {
        if (err) {
          clearTimeout(operationTimeout);
          try { conn.end(); } catch (e) {}
          finished = true;
          reject(err);
          return;
        }

        const dataTimeout = setTimeout(() => {
          if (!finished) {
            finished = true;
            try { stream.end(); } catch (e) {}
            try { conn.end(); } catch (e) {}
            reject(new Error('No data received from switch'));
          }
        }, 5000);

        stream.on('close', () => {
          if (finished) return;
          finished = true;
          clearTimeout(operationTimeout);
          clearTimeout(dataTimeout);
          try { conn.end(); } catch (e) {}

          const lines = result.split(/\r?\n/).filter(line => line.trim());
          let dataLine = lines.find(line => line.trim().startsWith('Gi') || line.trim().startsWith('Fa'));

          console.log('--- Cisco RAW Output ---');
          console.log(result);
          console.log('--- Parsed Line ---');
          console.log(dataLine);

          if (!dataLine) {
            const e = new Error('No port info found in output');
            (e as any).raw = result;
            reject(e);
            return;
          }

          const pattern = /(\S+)\s+(.{0,20})\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)/;
          const match = dataLine.match(pattern);
          if (!match) {
            const e = new Error('Failed to parse port info');
            (e as any).line = dataLine;
            reject(e);
            return;
          }

          const fields = {
            Port: match[1].trim(),
            Name: match[2].trim(),
            Status: match[3].trim(),
            Vlan: match[4].trim(),
            Duplex: match[5].trim(),
            Speed: match[6].trim(),
            Type: match[7].trim(),
          };

          console.log(`[${new Date().toISOString()}] Successfully parsed port info:`, fields);
          resolve(fields);
        })
        .on('data', (data: Buffer) => { result += data.toString(); })
        .stderr.on('data', (data: Buffer) => { console.error('SSH stderr:', data.toString()); result += data.toString(); });
      });
    })
    .on('error', (err: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(operationTimeout);
      try { conn.end(); } catch (e) {}
      const e2: any = new Error('SSH connection error: ' + err.message);
      e2.code = err.name;
      e2.hint = err.message.includes('ECONNREFUSED') ? 'Port 22 may be closed or unreachable' :
               err.message.includes('ETIMEDOUT') ? 'Connection timed out' :
               err.message.includes('Authentication failed') ? 'Check credentials' :
               'Check switch reachability and network settings';
      reject(e2);
    })
    .connect({
      host,
      username,
      password,
      port: 22,
      readyTimeout: 5000,
      keepaliveInterval: 1000,
      keepaliveCountMax: 3,
      debug: process.env.NODE_ENV === 'development' ? console.log : undefined,
      algorithms: {
        kex: [ 'diffie-hellman-group-exchange-sha1', 'diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1' ],
        cipher: [ 'aes128-cbc', '3des-cbc', 'aes192-cbc', 'aes256-cbc' ],
        serverHostKey: [ 'ssh-rsa' ]
      }
    });
  });
}

export async function getCiscoPortStatus(req: Request, res: Response) {
  res.set({ 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
  const port = String(req.query.port || '').trim();
  if (!port) return res.status(400).json({ error: 'Port is required' });
  try {
    // allow specifying site via query param: ?site=5|9|msk
    const site = String(req.query.site || '').trim();
    const data = await fetchCiscoPortInfo(port, site || undefined);
    
    // Ensure data is serializable
    if (!data) {
      return res.status(502).json({ error: 'No data received from Cisco' });
    }

    // Create a clean response object to ensure all fields are serializable
    const cleanData = {
      Port: String(data.Port || ''),
      Name: String(data.Name || ''),
      Status: String(data.Status || ''),
      Vlan: String(data.Vlan || ''),
      Duplex: String(data.Duplex || ''),
      Speed: String(data.Speed || ''),
      Type: String(data.Type || '')
    };

    try {
      // Validate that data can be serialized to JSON
      JSON.stringify(cleanData);
    } catch (serializeError) {
      console.error('Failed to serialize Cisco port data:', serializeError);
      return res.status(502).json({ error: 'Failed to serialize port data', details: String(serializeError) });
    }

    return res.json(cleanData);
  } catch (e: any) {
    console.error('getCiscoPortStatus error:', e);
    const status = (e && e.message && e.message.includes('Missing environment')) ? 500 : 502;
    const errorResponse = {
      error: e.message || 'Error',
      details: typeof e.details === 'object' ? JSON.stringify(e.details) : String(e.details || '')
    };
    return res.status(status).json(errorResponse);
  }
}
