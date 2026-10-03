const fs = require('fs');

const content = fs.readFileSync('BrainzOS.html', 'utf8');

const scriptIndex = content.indexOf('<script>');
const htmlPart = content.slice(0, scriptIndex);
const jsPart = content.slice(scriptIndex);

// Let's find all function definitions in jsPart
const funcBodies = new Map();
const funcRegex = /function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\{/g;
let fm;
while ((fm = funcRegex.exec(jsPart)) !== null) {
  const name = fm[1];
  const start = fm.index;
  // find matching brace
  let depth = 0;
  let end = start;
  for (let i = jsPart.indexOf('{', start); i < jsPart.length; i++) {
    if (jsPart[i] === '{') depth++;
    else if (jsPart[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  funcBodies.set(name, jsPart.substring(start, end));
}

console.log('Parsed function bodies count:', funcBodies.size);

// Helper to check if a function does real Supabase backend calls
function checkBackendCall(funcName) {
  if (!funcName) return false;
  // If it's inline JS, test the expression
  const body = funcBodies.get(funcName) || funcName;
  return /supabase\s*\.\s*from|supabase\s*\.\s*auth|supabase\s*\.\s*rpc|supabase\s*\.\s*storage/i.test(body);
}

// Helper to check if a function is a mock/placeholder/dummy/empty
function checkFunctionStatus(funcName, inlineCode) {
  const code = funcName ? (funcBodies.get(funcName) || '') : inlineCode;
  if (!code && !funcName) return { status: 'DEAD', reason: 'No handler' };
  
  if (funcName === 'startBiometricLogin') {
    return { status: 'FAKE', reason: 'Biometrics demo simulation with timeout' };
  }
  
  const hasSupabase = /supabase\s*\.\s*from|supabase\s*\.\s*auth|supabase\s*\.\s*rpc|supabase\s*\.\s*storage/i.test(code);
  const hasAuditLog = /audit_logs/i.test(code);
  const hasToast = /showToast/i.test(code);
  const isNavigate = /navigateTo/i.test(code);
  const isModalToggle = /classList\.(add|remove|toggle)\(['"](?:active|hidden)/.test(code) || /style\.display/.test(code);
  
  if (/coming soon|TODO|placeholder/i.test(code)) {
    return { status: 'DEAD', reason: 'Contains TODO/placeholder/coming soon' };
  }
  
  return { hasSupabase, hasAuditLog, hasToast, isNavigate, isModalToggle };
}

// Let's identify sections/pages
const lines = htmlPart.split('\n');
console.log('Total HTML lines:', lines.length);

fs.writeFileSync('scripts/func-names.json', JSON.stringify([...funcBodies.keys()], null, 2));
