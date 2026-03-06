const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const ldap = require('ldapjs');

const LDAP_URL = process.env.LDAP_URL;
const BIND_DN = process.env.LDAP_BIND_DN;
const BIND_PASSWORD = process.env.LDAP_BIND_PASSWORD;
const BASE_DN = process.env.LDAP_BASE_DN;

function domainFromBaseDn(baseDn) {
  if (!baseDn) return null;
  try {
    return baseDn.split(',').filter(p => p.startsWith('DC=')).map(p => p.split('=')[1]).join('.');
  } catch (e) { return null; }
}

const domain = domainFromBaseDn(BASE_DN);

const attempts = [];
if (BIND_DN) attempts.push({ desc: 'Bind DN (as is)', bind: BIND_DN });
if (domain && BIND_DN) {
  const firstRdn = BIND_DN.split(',')[0];
  const name = firstRdn.includes('=') ? firstRdn.split('=')[1] : firstRdn;
  attempts.push({ desc: 'UPN (user@domain) guessed from DN', bind: `${name}@${domain}` });
}
if (BIND_DN) {
  const firstRdn = BIND_DN.split(',')[0];
  const name = firstRdn.includes('=') ? firstRdn.split('=')[1] : firstRdn;
  attempts.push({ desc: 'sAMAccountName guess', bind: name });
}

(async () => {
  const urls = [];
  if (LDAP_URL) urls.push(LDAP_URL);
  if (LDAP_URL && LDAP_URL.startsWith('ldap://')) {
    try {
      const host = LDAP_URL.replace(/^ldap:\/\//, '').split(':')[0];
      urls.push(`ldaps://${host}:636`);
    } catch (e) {}
  }
  if (urls.length === 0) {
    console.error('No LDAP_URL');
    process.exit(1);
  }

  for (const url of urls) {
    console.log('\n== Trying LDAP server:', url, '==');
    for (const at of attempts) {
      console.log('--', at.desc, '=>', at.bind);
      const client = ldap.createClient({ url });
      await new Promise((resolve) => {
        let called = false;
        client.bind(at.bind, BIND_PASSWORD, (err) => {
          if (err) {
            console.error('  bind failed:', err && err.message ? err.message : err);
          } else {
            console.log('  bind succeeded');
          }
          try { client.unbind(); } catch (e) {}
          if (!called) { called = true; resolve(); }
        });
        setTimeout(() => { if (!called) { console.error('  bind timeout'); try { client.unbind(); } catch(e){}; called=true; resolve(); } }, 5000);
      });
    }
  }
})();
