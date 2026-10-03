/**
 * BrainzOS One-Time Director Account Bootstrap CLI
 * =========================================================================
 * Description: Securely initializes the very first Director account on a fresh
 * self-hosted BrainzOS cluster.
 *
 * Security Invariants:
 * 1. Takes email and password strictly from the CLI (arguments or interactive prompt).
 * 2. Never commits or logs passwords in cleartext.
 * 3. Enforces single-execution lock: If ANY director profile exists in the
 *    database, the script immediately aborts with an exit code 1.
 * =========================================================================
 */

const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return {};
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = process.env.SUPABASE_URL || env.SITE_URL || 'http://127.0.0.1';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('[ERROR] SERVICE_ROLE_KEY is not configured in .env or environment.');
  console.error('Please run `node scripts/generate-keys.js --write` first to generate your keys.');
  process.exit(1);
}

// Require @supabase/supabase-js
let createClient;
try {
  createClient = require('@supabase/supabase-js').createClient;
} catch (e) {
  // If not found in node_modules, load from vendor
  try {
    const vendorSupabase = require('../vendor/supabase.min.js');
    createClient = vendorSupabase.createClient || vendorSupabase;
  } catch (err) {
    console.error('[ERROR] Could not load @supabase/supabase-js. Run npm install or check vendor directory.');
    process.exit(1);
  }
}

function prompt(question, hideInput = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    if (hideInput && process.stdin.isTTY) {
      process.stdout.write(question);
      process.stdin.setRawMode(true);
      let pwd = '';
      process.stdin.on('data', char => {
        char = char + '';
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004':
            process.stdin.setRawMode(false);
            process.stdout.write('\n');
            rl.close();
            resolve(pwd);
            break;
          case '\u0003': // Ctrl+C
            process.exit(1);
            break;
          default:
            pwd += char;
            process.stdout.write('*');
            break;
        }
      });
    } else {
      rl.question(question, answer => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      result.email = args[i + 1];
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
      result.password = args[i + 1];
      i++;
    } else if (args[i] === '--name' && args[i + 1]) {
      result.name = args[i + 1];
      i++;
    }
  }
  return result;
}

async function main() {
  console.log('===================================================================');
  console.log('BrainzOS Institutional Onboarding — One-Time Director Bootstrap');
  console.log('===================================================================');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 1. Verify Single-Execution Lock: Check if a director already exists
  console.log('Verifying director table state in database...');
  const { data: existingDirectors, error: checkError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('role', 'director')
    .limit(1);

  if (checkError) {
    console.error('[ERROR] Failed to query database profiles table:', checkError.message);
    process.exit(1);
  }

  if (existingDirectors && existingDirectors.length > 0) {
    console.error('\n[ABORTED: SECURITY VIOLATION]');
    console.error('A Director account is already registered on this BrainzOS cluster:');
    console.error(`  - Existing Account: ${existingDirectors[0].email} (${existingDirectors[0].full_name})`);
    console.error('For institutional security, the bootstrap script is permanently locked.');
    console.error('All subsequent faculty and administrators must be provisioned through');
    console.error('the Director Console inside BrainzOS.\n');
    process.exit(1);
  }

  // 2. Collect credentials from CLI
  const cliArgs = parseArgs();
  let email = cliArgs.email;
  let password = cliArgs.password;
  let name = cliArgs.name || 'School Director';

  if (!email) {
    email = await prompt('Enter Director School Email Address: ');
  }
  if (!password) {
    password = await prompt('Enter Secure Director Password: ', true);
  }

  if (!email || !email.includes('@')) {
    console.error('[ERROR] A valid email address is required.');
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.error('[ERROR] Password must be at least 8 characters long.');
    process.exit(1);
  }

  console.log(`\nCreating initial Director account for: ${email}...`);

  // 3. Create Auth User via Supabase Admin API
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: {
      role: 'director',
      full_name: name
    }
  });

  if (authError) {
    console.error('[ERROR] Could not create auth account:', authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;

  // 4. Upsert Profile with Role='director'
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: email,
      full_name: name,
      role: 'director',
      status: 'active',
      student_id_code: 'DIR-001'
    });

  if (profileError) {
    console.error('[ERROR] Could not create director profile:', profileError.message);
    process.exit(1);
  }

  // 5. Write Immutable Audit Record
  try {
    await supabase.from('audit_logs').insert({
      actor_id: userId,
      action: `Institutional Cluster Bootstrapped: First Director provisioned (${email})`,
      device: 'Server CLI Bootstrap'
    });
  } catch (err) {
    console.warn('[WARN] Audit log record could not be written:', err.message);
  }

  console.log('\n===================================================================');
  console.log('SUCCESS: First Director account successfully bootstrapped!');
  console.log(`  Director: ${name}`);
  console.log(`  Email:    ${email}`);
  console.log(`  User ID:  ${userId}`);
  console.log('===================================================================');
  console.log('Notice: The bootstrap-director script is now permanently locked.');
  console.log('You can now log in to BrainzOS using these credentials to onboard faculty.');
  console.log('===================================================================\n');
}

main().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
