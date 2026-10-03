/**
 * BrainzOS Key & Secret Generation Tool
 * =========================================================================
 * Generates cryptographically secure production secrets for self-hosted
 * Supabase (PostgreSQL password, JWT secret, Anon key, and Service Role key).
 * Uses standard Node.js crypto module (HMAC-SHA256).
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function generateKeys() {
  const dbPassword = crypto.randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, 'X');
  const jwtSecret = crypto.randomBytes(48).toString('hex');

  const now = Math.floor(Date.now() / 1000);
  const tenYears = 60 * 60 * 24 * 365 * 10;

  const anonPayload = {
    role: 'anon',
    iss: 'supabase',
    iat: now,
    exp: now + tenYears
  };

  const servicePayload = {
    role: 'service_role',
    iss: 'supabase',
    iat: now,
    exp: now + tenYears
  };

  const anonKey = signJwt(anonPayload, jwtSecret);
  const serviceRoleKey = signJwt(servicePayload, jwtSecret);

  return {
    dbPassword,
    jwtSecret,
    anonKey,
    serviceRoleKey
  };
}

if (require.main === module) {
  const keys = generateKeys();
  const envContent = `# =============================================================================
# BrainzOS Self-Hosted Production Secrets
# Generated: ${new Date().toISOString()}
# =============================================================================
APP_PORT=80
SITE_URL=http://localhost
API_EXTERNAL_URL=http://localhost

POSTGRES_PASSWORD=${keys.dbPassword}
JWT_SECRET=${keys.jwtSecret}
ANON_KEY=${keys.anonKey}
SERVICE_ROLE_KEY=${keys.serviceRoleKey}
`;

  const shouldWrite = process.argv.includes('--write');
  if (shouldWrite) {
    const envPath = path.join(__dirname, '..', '.env');
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('Successfully generated fresh production keys and saved to .env');
    console.log('Database Password, JWT Secret, Anon Key, and Service Role Key are ready.');
  } else {
    console.log(envContent);
    console.log('Run `node scripts/generate-keys.js --write` to write directly to .env.');
  }
}

module.exports = { generateKeys, signJwt };
