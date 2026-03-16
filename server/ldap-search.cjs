const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const ldap = require('ldapjs');

const LDAP_URL = process.env.LDAP_URL;
const BIND_DN = process.env.LDAP_BIND_DN;
const BIND_PASSWORD = process.env.LDAP_BIND_PASSWORD;
const BASE_DN = process.env.LDAP_BASE_DN;

// Escape LDAP filter special characters to prevent LDAP injection attacks
function escapeLdapFilter(value) {
  if (typeof value !== 'string') return '';
  // RFC 4515 escape: special chars in LDAP filters must be escaped
  return value
    .replace(/\\/g, '\\5c') // backslash
    .replace(/\*/g, '\\2a') // asterisk
    .replace(/\(/g, '\\28') // left paren
    .replace(/\)/g, '\\29') // right paren
    .replace(/\x00/g, '\\00'); // null byte
}

async function doSearch(login) {
  function domainFromBaseDn(baseDn) {
    if (!baseDn) return null;
    try { return baseDn.split(',').filter(p => p.startsWith('DC=')).map(p => p.split('=')[1]).join('.'); } catch(e){return null;}
  }
  const domain = domainFromBaseDn(BASE_DN);

  const candidates = [];
  if (BIND_DN) candidates.push(BIND_DN);
  let rdnName = null;
  if (BIND_DN && BIND_DN.includes(',')) {
    const first = BIND_DN.split(',')[0];
    if (first.includes('=')) rdnName = first.split('=')[1];
  }
  if (rdnName) candidates.push(rdnName);
  if (rdnName && domain) candidates.push(`${rdnName}@${domain}`);

  const client = ldap.createClient({ url: LDAP_URL });
  client.on('error', (e) => console.error('LDAP client error', e && e.message));

  let bound = false;
  for (const c of candidates) {
    try {
      await new Promise((resolve, reject) => {
        let called = false;
        client.bind(c, BIND_PASSWORD, (err) => {
          if (called) return;
          called = true;
          if (err) return reject(err);
          resolve();
        });
        setTimeout(() => { if (!called) { called = true; reject(new Error('bind timeout')); } }, 5000);
      });
      console.log('Bound with', c);
      bound = true;
      break;
    } catch (err) {
      console.warn('Bind failed for', c, err && err.message);
    }
  }
  if (!bound) {
    client.unbind();
    throw new Error('All bind attempts failed');
  }

  const opts = { filter: `(sAMAccountName=${escapeLdapFilter(login)})`, scope: 'sub', attributes: ['cn','mail','department','sAMAccountName'] };
  await new Promise((resolve, reject) => {
    client.search(BASE_DN, opts, (err, res) => {
      if (err) return reject(err);
      let found = false;
      res.on('searchEntry', (entry) => {
        found = true;
        console.log('Entry keys:', Object.keys(entry));
        try {
          console.log('Entry (dir):');
          console.dir(entry, { depth: 4 });
        } catch (e) {
          console.log('Entry raw:', entry);
        }
      });
      res.on('error', (err) => reject(err));
      res.on('end', () => { if (!found) console.log('No entries found'); resolve(); });
    });
  });
  client.unbind();
}

const login = process.argv[2] || 'office-map';
console.log('Searching for', login);
doSearch(login).then(() => process.exit(0)).catch(err => { console.error('Search failed', err && err.message); process.exit(1); });
