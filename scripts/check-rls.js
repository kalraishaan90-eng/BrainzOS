const fs = require('fs');
const path = require('path');

const dir = 'supabase/migrations';
const tables = new Set();
const rlsEnabledTables = new Set();

fs.readdirSync(dir).forEach(file => {
  if (!file.endsWith('.sql')) return;
  const content = fs.readFileSync(path.join(dir, file), 'utf8');

  // Detect CREATE TABLE
  const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi;
  let m;
  while ((m = createRegex.exec(content))) {
    tables.add(m[1].toLowerCase());
  }

  // Detect ENABLE ROW LEVEL SECURITY
  const rlsRegex = /ALTER\s+TABLE\s+(?:public\.)?([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
  while ((m = rlsRegex.exec(content))) {
    rlsEnabledTables.add(m[1].toLowerCase());
  }
});

console.log('Total tables defined in schema:', tables.size);
console.log('Tables with RLS enabled:', rlsEnabledTables.size);

const unshielded = [...tables].filter(t => !rlsEnabledTables.has(t));
if (unshielded.length > 0) {
  console.warn('Tables missing RLS enable:', unshielded);
} else {
  console.log('ALL public tables have ENABLE ROW LEVEL SECURITY!');
}
