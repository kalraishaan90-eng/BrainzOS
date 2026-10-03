const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const ALT_PORT = 8080;
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

function generateSeedClassSections() {
  const sections = ['A', 'B', 'C', 'D'];
  const streams = ['Commerce', 'Science', 'Humanities'];
  const rom = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII' };
  const list = [];
  let count = 1;

  for (let g = 1; g <= 10; g++) {
    for (const s of sections) {
      const id = `cs-00000000-0000-4000-a000-${String(count++).padStart(12, '0')}`;
      list.push({
        id,
        grade: g,
        section: s,
        stream: null,
        display_name: `Class ${g}-${s}`,
        active: true
      });
    }
  }

  for (let g = 11; g <= 12; g++) {
    for (const s of sections) {
      for (const str of streams) {
        const id = `cs-00000000-0000-4000-a000-${String(count++).padStart(12, '0')}`;
        list.push({
          id,
          grade: g,
          section: s,
          stream: str,
          display_name: `Class ${rom[g]}-${s} (${str})`,
          active: true
        });
      }
    }
  }
  return list;
}

const SEED_PROFILES = [
  { id: 'a0000000-0000-0000-0000-000000000001', role: 'student', role_confirmed: true, full_name: 'Student Scholar', email: 'student@brainz.edu', class_section: 'XII-B', student_id_code: '1102-01', house: 'Nalanda', houses: { id: 'nalanda', name: 'Nalanda', points: 150 } },
  { id: 'a0000000-0000-0000-0000-000000000002', role: 'teacher', role_confirmed: true, full_name: 'Faculty Member', email: 'teacher@brainz.edu', class_section: 'XI-B', house: null, houses: null },
  { id: 'a0000000-0000-0000-0000-000000000003', role: 'director', role_confirmed: true, full_name: 'School Director', email: 'director@brainz.edu', class_section: null, house: null, houses: null },
  { id: 'b0000000-0000-0000-0000-000000000001', role: 'student', role_confirmed: true, full_name: 'Ishaan Kalra', email: 'ishaan.kalra@brainz.edu', class_section: 'XI-B', student_id_code: 'BOS-XIB-041', house: 'Nalanda', houses: { id: 'nalanda', name: 'Nalanda', points: 150 } },
  { id: 'b0000000-0000-0000-0000-000000000051', role: 'student', role_confirmed: true, full_name: 'Siddharth Rao', email: 'siddharth.rao@brainz.edu', class_section: 'XI-A', student_id_code: 'BOS-XIA-012', house: 'Takshashila', houses: { id: 'takshashila', name: 'Takshashila', points: 130 } },
  { id: 'b0000000-0000-0000-0000-000000000052', role: 'student', role_confirmed: true, full_name: 'Riya Malhotra', email: 'riya.malhotra@brainz.edu', class_section: 'XII-A', student_id_code: 'BOS-XIIA-008', house: 'Nalanda', houses: { id: 'nalanda', name: 'Nalanda', points: 150 } },
  { id: 'b0000000-0000-0000-0000-000000000053', role: 'student', role_confirmed: true, full_name: 'Ananya Gupta', email: 'ananya.gupta@brainz.edu', class_section: '3-A', student_id_code: 'BOS-03A-001', house: 'Nalanda', houses: { id: 'nalanda', name: 'Nalanda', points: 150 } },
  { id: 'b0000000-0000-0000-0000-000000000054', role: 'student', role_confirmed: true, full_name: 'Kabir Singh', email: 'kabir.singh@brainz.edu', class_section: '8-A', student_id_code: 'BOS-08A-001', house: 'Takshashila', houses: { id: 'takshashila', name: 'Takshashila', points: 130 } }
];

const DEFAULT_DB = {
  profiles: SEED_PROFILES,
  class_sections: generateSeedClassSections(),
  houses: [
    { id: 'nalanda', name: 'Nalanda', points: 150 },
    { id: 'takshashila', name: 'Takshashila', points: 130 }
  ],
  test_schedule: [
    {
      id: 'ts-init-1',
      teacher_id: 'a0000000-0000-0000-0000-000000000002',
      teacher_name: 'Faculty Member',
      class_section: 'XI-B',
      subject: 'Political Science',
      date: '2026-10-05',
      topic: 'Constitutional Design & Rights'
    },
    {
      id: 'ts-init-2',
      teacher_id: 'a0000000-0000-0000-0000-000000000002',
      teacher_name: 'Faculty Member',
      class_section: 'XI-B',
      subject: 'Economics',
      date: '2026-10-12',
      topic: 'Consumer Equilibrium & Demand Analysis'
    }
  ],
  broadcasts: [
    {
      id: 'bc-init-1',
      headline: 'CBSE Term I Moderation Schedule Confirmed',
      message: 'Institutional assessment moderation and hall tickets will be issued by the examination directorate this week.',
      audience: 'Whole School',
      category: 'Academics',
      author: 'School Director',
      published_by: 'a0000000-0000-0000-0000-000000000003',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 'bc-init-2',
      headline: 'Campus Library Extended Study Hours',
      message: 'The central academic library and digital pods are now open till 8:00 PM for senior secondary students.',
      audience: 'Students Only',
      category: 'Student Life',
      author: 'School Director',
      published_by: 'a0000000-0000-0000-0000-000000000003',
      created_at: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
      id: 'bc-init-3',
      headline: 'Departmental Faculty Moderation Briefing',
      message: 'All teaching faculty are requested to submit internal syllabus completion benchmarks by Friday 4 PM.',
      audience: 'Teachers Only',
      category: 'Operations',
      author: 'School Director',
      published_by: 'a0000000-0000-0000-0000-000000000003',
      created_at: new Date(Date.now() - 3600000 * 8).toISOString()
    }
  ],
  assignments: [
    {
      id: 'asg-init-1',
      title: 'Elasticity of Demand & Price Mechanism',
      class_section: 'XI-B',
      due_date: '2026-10-02',
      instructions: 'Complete exercises 1 to 4 from chapter 3 of NCERT Economics.',
      status: 'active'
    }
  ],
  lecture_plan: [
    {
      id: 'lp-init-1',
      teacher_id: 'a0000000-0000-0000-0000-000000000002',
      class_section: 'XI-B',
      subject: 'Political Science',
      date: new Date().toISOString().split('T')[0],
      topic: 'Philosophy of the Constitution',
      completed: true,
      completed_at: new Date().toISOString()
    }
  ],
  attendance_records: [],
  leave_records: [],
  audit_logs: []
};

// Database load and persist helpers
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

let DB = DEFAULT_DB;
try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    DB = Object.assign({}, DEFAULT_DB, JSON.parse(raw));
    if (!DB.class_sections || DB.class_sections.length === 0) {
      DB.class_sections = generateSeedClassSections();
      fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2));
    }
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2));
  }
} catch (e) {
  console.warn('[DB] Error loading db.json, using defaults:', e.message);
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2));
  } catch (e) {
    console.error('[DB] Error saving db.json:', e);
  }
}

// Connected WebSocket / SSE clients
const realtimeClients = new Set();
function notifyRealtimeClients(tableName, event, record) {
  const payload = JSON.stringify({ table: tableName, event, record });
  for (const client of realtimeClients) {
    try {
      if (client.readyState === 1) { // WebSocket open
        client.send(payload);
      } else if (client.write) { // SSE
        client.write(`data: ${payload}\n\n`);
      }
    } catch (e) {
      realtimeClients.delete(client);
    }
  }
}

// Request Handler
function handleRequest(req, res) {
  // CORS & headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info, Prefer, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const reqPath = decodeURI(parsedUrl.pathname);

  // Helper to construct standard JWT format for Supabase client compatibility
  function makeMockJwt(payloadObj) {
    const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const header = b64({ alg: 'HS256', typ: 'JWT' });
    const payload = b64(payloadObj);
    const signature = Buffer.from('mock-sig').toString('base64url');
    return `${header}.${payload}.${signature}`;
  }

  // 1. Mock Supabase Auth Endpoint
  if (reqPath.startsWith('/auth/v1/')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let email = null;
      let roleFromToken = null;
      let user = null;
      const authHeader = req.headers['authorization'] || '';

      if (authHeader.startsWith('Bearer ')) {
        const rawToken = authHeader.replace('Bearer ', '').trim();
        if (rawToken.startsWith('mock-local-token-')) {
          roleFromToken = rawToken.replace('mock-local-token-', '').trim();
        } else if (rawToken.includes('.')) {
          try {
            const parts = rawToken.split('.');
            if (parts.length === 3) {
              const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
              if (decoded.user_metadata && decoded.user_metadata.role) {
                roleFromToken = decoded.user_metadata.role;
              }
              if (decoded.sub) {
                const u = DB.profiles.find(p => p.id === decoded.sub);
                if (u) user = u;
              }
            }
          } catch (e) {}
        }
      }

      try {
        const parsed = JSON.parse(body);
        if (parsed.email) email = parsed.email;
        if (parsed.refresh_token && parsed.refresh_token.startsWith('mock-refresh-')) {
          roleFromToken = parsed.refresh_token.replace('mock-refresh-', '').trim();
        }
      } catch (e) {}

      if (!user && email) {
        user = DB.profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
      }
      if (!user && roleFromToken) {
        user = DB.profiles.find(p => p.role.toLowerCase() === roleFromToken.toLowerCase());
      }
      if (!user) {
        user = DB.profiles.find(p => p.role === 'director') || DB.profiles[0];
      }

      if (req.method === 'GET' && reqPath.includes('/user')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: user.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: user.email,
          user_metadata: { role: user.role, full_name: user.full_name }
        }));
        return;
      }

      const exp = Math.floor(Date.now() / 1000) + 86400 * 7;
      const accessToken = makeMockJwt({
        sub: user.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: user.email,
        app_metadata: { provider: 'email' },
        user_metadata: { role: user.role, full_name: user.full_name },
        exp: exp
      });

      const tokenResponse = {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 86400 * 7,
        refresh_token: 'mock-refresh-' + user.role,
        user: {
          id: user.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: user.email,
          user_metadata: { role: user.role, full_name: user.full_name }
        }
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tokenResponse));
    });
    return;
  }

  // 1.5 Edge Function Endpoint: /functions/v1/create-teacher
  if (reqPath.startsWith('/functions/v1/create-teacher')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let payload = {};
      try { payload = JSON.parse(body); } catch (e) {}

      const fullName = (payload.full_name || '').trim();
      const email = (payload.email || '').trim().toLowerCase();

      if (!fullName || fullName.length < 2) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Faculty member's full name is required (minimum 2 characters)." }));
        return;
      }
      if (!email || !email.includes('@')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "A valid email address is required." }));
        return;
      }

      // Class section validation
      let submittedIds = [];
      if (Array.isArray(payload.class_section_ids) && payload.class_section_ids.length > 0) {
        submittedIds = payload.class_section_ids.map(id => String(id).trim()).filter(Boolean);
      } else if (Array.isArray(payload.class_sections_taught) && payload.class_sections_taught.length > 0) {
        submittedIds = payload.class_sections_taught.map(id => String(id).trim()).filter(Boolean);
      } else if (typeof payload.class_sections_taught === 'string' && payload.class_sections_taught.trim()) {
        submittedIds = payload.class_sections_taught.split(',').map(s => s.trim()).filter(Boolean);
      }

      if (submittedIds.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "At least one class section must be selected for the faculty member." }));
        return;
      }

      const availableSections = DB.class_sections || [];
      const romMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII' };
      const toRoman = n => romMap[n] || String(n);
      const validatedSections = [];

      for (const token of submittedIds) {
        const match = availableSections.find(cs =>
          cs.id === token ||
          cs.display_name.toLowerCase() === token.toLowerCase() ||
          `${cs.grade}-${cs.section}`.toLowerCase() === token.toLowerCase() ||
          (cs.grade >= 11 && `${toRoman(cs.grade)}-${cs.section}`.toLowerCase() === token.toLowerCase()) ||
          (cs.grade >= 11 && `${toRoman(cs.grade)}-${cs.section} ${cs.stream}`.toLowerCase() === token.toLowerCase()) ||
          (cs.grade >= 11 && `Class ${toRoman(cs.grade)}-${cs.section}`.toLowerCase() === token.toLowerCase())
        );

        if (!match) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: `Invalid class section: "${token}" does not exist in the institutional class registry.`,
            code: "CLASS_SECTION_NOT_FOUND"
          }));
          return;
        }

        if (!match.active) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: `Class section "${match.display_name}" is deactivated. Only active sections can be assigned to faculty.`,
            code: "CLASS_SECTION_INACTIVE"
          }));
          return;
        }

        if (!validatedSections.some(v => v.id === match.id)) {
          validatedSections.push(match);
        }
      }

      const classSectionCodes = validatedSections.map(cs => {
        if (cs.grade >= 11) {
          return `${toRoman(cs.grade)}-${cs.section}`;
        }
        return `${cs.grade}-${cs.section}`;
      });
      const classesStr = classSectionCodes.join(', ');
      const verifiedDisplayNames = validatedSections.map(cs => cs.display_name).join(', ');

      const dup = DB.profiles.find(p => (p.email || '').toLowerCase() === email);
      if (dup) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'A user with this email/username already exists in the institutional registry.' }));
        return;
      }

      const tempPwd = 'BOS-' + crypto.randomBytes(3).toString('hex').toUpperCase() + '!';
      const teacherId = 'teacher-' + Date.now();
      const newTeacher = {
        id: teacherId,
        role: 'teacher',
        role_confirmed: true,
        full_name: fullName,
        email: email,
        class_section: classesStr,
        status: 'active'
      };

      DB.profiles.push(newTeacher);
      saveDB();
      notifyRealtimeClients('profiles', 'INSERT', newTeacher);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        credentials: {
          id: teacherId,
          full_name: fullName,
          email: email,
          temporary_password: tempPwd,
          role: 'teacher',
          class_sections_taught: verifiedDisplayNames,
          class_section_codes: classesStr
        }
      }));
    });
    return;
  }

  // 2. Realtime SSE Endpoint
  if (reqPath === '/realtime/v1/sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('retry: 3000\n\n');
    realtimeClients.add(res);
    req.on('close', () => realtimeClients.delete(res));
    return;
  }

  // 3. PostgREST API Endpoint (/rest/v1/...)
  if (reqPath.startsWith('/rest/v1/')) {
    res.setHeader('Content-Type', 'application/json');

    const tableMatch = reqPath.match(/\/rest\/v1\/([a-zA-Z0-9_]+)/);
    const tableName = tableMatch ? tableMatch[1] : '';

    if (!DB[tableName]) {
      DB[tableName] = [];
    }

    const isSingle = req.headers['accept'] && req.headers['accept'].includes('vnd.pgrst.object+json');

    // POST /rest/v1/tableName
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}

        const items = Array.isArray(payload) ? payload : [payload];
        const inserted = [];

        items.forEach(item => {
          const rec = Object.assign({}, item);
          if (!rec.id) rec.id = `${tableName.slice(0, 3)}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
          if (!rec.created_at) rec.created_at = new Date().toISOString();

          // Profile resolution
          if (tableName === 'test_schedule') {
            if (!rec.teacher_name) {
              const p = DB.profiles.find(u => u.id === rec.teacher_id);
              rec.teacher_name = p ? p.full_name : 'Faculty Member';
            }
          }
          if (tableName === 'broadcasts') {
            if (!rec.author) {
              const p = DB.profiles.find(u => u.id === rec.published_by);
              rec.author = p ? p.full_name : 'Administration';
            }
          }
          if (tableName === 'audit_logs') {
            if (!rec.actor_name && rec.actor_id) {
              const p = DB.profiles.find(u => u.id === rec.actor_id);
              rec.actor_name = p ? p.full_name : 'System';
            }
          }

          DB[tableName].push(rec);
          inserted.push(rec);
          notifyRealtimeClients(tableName, 'INSERT', rec);
        });

        saveDB();

        res.setHeader('Content-Range', `0-${inserted.length - 1}/${DB[tableName].length}`);
        res.writeHead(201);
        if (isSingle) {
          res.end(JSON.stringify(inserted[0] || {}));
        } else {
          res.end(JSON.stringify(inserted));
        }
      });
      return;
    }

    // PATCH / PUT /rest/v1/tableName
    if (req.method === 'PATCH' || req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let updateData = {};
        try { updateData = JSON.parse(body); } catch (e) {}

        const updated = [];
        DB[tableName] = DB[tableName].map(row => {
          let match = true;
          for (const [key, val] of parsedUrl.searchParams.entries()) {
            if (key === 'select' || key === 'order' || key === 'limit') continue;
            if (val.startsWith('eq.')) {
              if (String(row[key]) !== val.slice(3)) match = false;
            }
          }
          if (match) {
            const merged = Object.assign({}, row, updateData);
            updated.push(merged);
            notifyRealtimeClients(tableName, 'UPDATE', merged);
            return merged;
          }
          return row;
        });

        saveDB();
        res.writeHead(200);
        res.end(JSON.stringify(isSingle ? (updated[0] || {}) : updated));
      });
      return;
    }

    // DELETE /rest/v1/tableName
    if (req.method === 'DELETE') {
      const remaining = [];
      const deleted = [];

      DB[tableName].forEach(row => {
        let match = true;
        for (const [key, val] of parsedUrl.searchParams.entries()) {
          if (key === 'select' || key === 'order' || key === 'limit') continue;
          if (val.startsWith('eq.')) {
            if (String(row[key]) !== val.slice(3)) match = false;
          }
        }
        if (match) {
          deleted.push(row);
          notifyRealtimeClients(tableName, 'DELETE', row);
        } else {
          remaining.push(row);
        }
      });

      DB[tableName] = remaining;
      saveDB();
      res.writeHead(204);
      res.end();
      return;
    }

    // GET /rest/v1/tableName
    let results = [...DB[tableName]];

    // Filtering
    for (const [key, val] of parsedUrl.searchParams.entries()) {
      if (key === 'select' || key === 'order' || key === 'limit') continue;
      if (val.startsWith('eq.')) {
        const expected = val.slice(3);
        results = results.filter(r => String(r[key]) === expected);
      } else if (val.startsWith('neq.')) {
        const expected = val.slice(4);
        results = results.filter(r => String(r[key]) !== expected);
      } else if (val.startsWith('gte.')) {
        const expected = val.slice(4);
        results = results.filter(r => String(r[key]) >= expected);
      } else if (val.startsWith('lte.')) {
        const expected = val.slice(4);
        results = results.filter(r => String(r[key]) <= expected);
      }
    }

    // Joins & Expansions for profiles
    const selectParam = parsedUrl.searchParams.get('select') || '';
    if (selectParam.includes('profiles')) {
      // Supports both plain `profiles(...)` and aliased FK selects such as
      // `author:profiles!author_id(full_name, role)`; the embedded row is
      // exposed under the alias (when present) and the bare `profiles` key.
      const aliasMatch = selectParam.match(/([a-zA-Z_][a-zA-Z0-9_]*):\s*profiles(!([a-z_]+))?/);
      const alias = aliasMatch ? aliasMatch[1] : null;
      const hintedFk = aliasMatch && aliasMatch[3] ? aliasMatch[3] : null;
      results = results.map(r => {
        const copy = Object.assign({}, r);
        // Follow the hinted FK when given (e.g. author_id), else the legacy
        // column chain; `student_id` is last because it names the row's
        // subject, not its author.
        const profileId = hintedFk && copy[hintedFk]
          ? copy[hintedFk]
          : (copy.teacher_id || copy.published_by || copy.actor_id || copy.author_id || copy.student_id);
        const prof = DB.profiles.find(p => p.id === profileId);
        const embedded = prof ? { full_name: prof.full_name, role: prof.role } : { full_name: copy.teacher_name || copy.author || 'System' };
        if (alias) copy[alias] = embedded;
        copy.profiles = embedded;
        return copy;
      });
    }

    // Ordering
    const orderParam = parsedUrl.searchParams.get('order');
    if (orderParam) {
      const [col, dir] = orderParam.split('.');
      const isDesc = (dir === 'desc');
      results.sort((a, b) => {
        const vA = a[col] != null ? a[col] : '';
        const vB = b[col] != null ? b[col] : '';
        return isDesc ? String(vB).localeCompare(String(vA)) : String(vA).localeCompare(String(vB));
      });
    }

    // Limit
    const limitParam = parsedUrl.searchParams.get('limit');
    if (limitParam) {
      const limit = parseInt(limitParam, 10);
      if (!isNaN(limit)) results = results.slice(0, limit);
    }

    res.setHeader('Content-Range', `0-${Math.max(0, results.length - 1)}/${results.length}`);

    if (isSingle) {
      res.setHeader('Content-Type', 'application/vnd.pgrst.object+json');
      res.writeHead(200);
      res.end(JSON.stringify(results[0] || null));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify(results));
    return;
  }

  // 4. Static Assets Server
  let filePathStr = reqPath;
  if (filePathStr === '/' || filePathStr === '/BrainzOS') filePathStr = '/BrainzOS.html';
  const filePath = path.join(ROOT, filePathStr);

  // Fallback for /realtime/ or /favicon.ico
  if (reqPath.startsWith('/realtime/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'connected' }));
    return;
  }

  if (reqPath === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    console.log('[404]', req.method, reqPath);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

function handleUpgrade(req, socket, head) {
  const key = req.headers['sec-websocket-key'];
  if (key) {
    const digest = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
                 'Upgrade: websocket\r\n' +
                 'Connection: Upgrade\r\n' +
                 `Sec-WebSocket-Accept: ${digest}\r\n\r\n`);
  } else {
    socket.destroy();
  }
}

// Primary Server
const server = http.createServer(handleRequest);
server.on('upgrade', handleUpgrade);
server.on('clientError', (err, socket) => {
  if (err.code === 'ECONNRESET' || !socket.writable) {
    return;
  }
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.on('error', (err) => {
  console.error('[BrainzOS Backend Server Error]:', err);
});

process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
    return;
  }
  console.error('[BrainzOS Backend Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[BrainzOS Backend Unhandled Rejection]:', reason);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[BrainzOS Backend] Running at http://127.0.0.1:${PORT}`);
});

// Secondary listener on ALT_PORT (8080) if PORT != ALT_PORT
if (PORT !== ALT_PORT) {
  try {
    const altServer = http.createServer(handleRequest);
    altServer.on('upgrade', handleUpgrade);
    altServer.on('clientError', (err, socket) => {
      if (err.code === 'ECONNRESET' || !socket.writable) {
        return;
      }
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });
    altServer.listen(ALT_PORT, '0.0.0.0', () => {
      console.log(`[BrainzOS Backend] Also listening on alternate port http://127.0.0.1:${ALT_PORT}`);
    });
    altServer.on('error', (err) => {
      console.log(`[BrainzOS Backend] Alt port ${ALT_PORT} not bound (${err.message})`);
    });
  } catch (e) {}
}
