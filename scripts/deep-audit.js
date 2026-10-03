const fs = require('fs');

const inventory = JSON.parse(fs.readFileSync('scripts/initial-inventory.json', 'utf8'));
const content = fs.readFileSync('BrainzOS.html', 'utf8');

const scriptStart = content.indexOf('<script>');
const jsPart = content.slice(scriptStart);

// Extract all functions and their bodies
const funcs = new Map();
const funcRegex = /function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\{/g;
let m;
while ((m = funcRegex.exec(jsPart)) !== null) {
  const name = m[1];
  const start = m.index;
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
  funcs.set(name, jsPart.substring(start, end));
}

// Let's audit each element in inventory
const audited = [];

inventory.forEach(item => {
  let handlerName = item.handlerName;
  let handlerCode = '';
  let doesWhat = item.doesWhat;
  let realBackend = false;
  let status = 'WORKING';
  let issue = '';

  // Match handler function
  if (item.onclick) {
    const fnMatch = item.onclick.match(/([a-zA-Z0-9_]+)\s*\(/);
    if (fnMatch) {
      handlerName = fnMatch[1];
      handlerCode = funcs.get(handlerName) || '';
    } else {
      handlerCode = item.onclick; // inline JS
    }
  }

  // Check if handler exists
  if (item.onclick && !handlerCode && !funcs.has(handlerName)) {
    // Might be simple JS expression e.g. navigateTo(...)
    if (item.onclick.includes('navigateTo(')) {
      doesWhat = item.onclick;
      handlerCode = item.onclick;
    } else {
      status = 'DEAD';
      issue = `Handler ${item.onclick} not found in script`;
    }
  }

  if (handlerCode) {
    // Check if it calls navigateTo
    if (handlerCode.includes('navigateTo(') || item.onclick && item.onclick.includes('navigateTo(')) {
      const targetPage = (item.onclick || handlerCode).match(/navigateTo\(['"]([^'"]+)['"]/);
      doesWhat = targetPage ? `Navigates to ${targetPage[1]}` : 'Navigates page';
      status = 'WORKING';
    }

    // Check backend calls
    if (/supabase\s*\.\s*(?:from|auth|rpc|storage)/i.test(handlerCode)) {
      realBackend = true;
      const tableMatch = handlerCode.match(/supabase\s*\.\s*from\(['"]([^'"]+)['"]\)/);
      const authMatch = handlerCode.match(/supabase\s*\.\s*auth\.([a-zA-Z0-9_]+)/);
      const rpcMatch = handlerCode.match(/supabase\s*\.\s*rpc\(['"]([^'"]+)['"]\)/);
      if (tableMatch) doesWhat = `DB query on table '${tableMatch[1]}'`;
      else if (authMatch) doesWhat = `Supabase auth.${authMatch[1]}()`;
      else if (rpcMatch) doesWhat = `RPC call '${rpcMatch[1]}'`;
    }

    // Modal close/open
    if (/classList\.(?:add|remove)\(['"]active['"]\)/.test(handlerCode) || /style\.display/.test(handlerCode)) {
      if (!doesWhat) doesWhat = 'Toggles modal / overlay visibility';
    }

    // Check specific known fake or dead functions
    if (handlerName === 'startBiometricLogin') {
      status = 'FAKE';
      issue = 'Decorative demo simulation with setTimeout';
      doesWhat = 'Fake biometric scan animation';
    } else if (handlerName === 'exportExecutiveSummary') {
      status = 'FAKE';
      issue = 'Shows toast and logs audit event, but downloads nothing';
      doesWhat = 'Logs audit event & shows toast (no download)';
    } else if (handlerName === 'exportTeacherDossier') {
      status = 'FAKE';
      issue = 'Shows toast and logs audit event, but does not print or download';
      doesWhat = 'Logs audit event & shows toast (no print/export)';
    } else if (handlerName === 'exportAuditLogsCSV') {
      status = 'FAKE';
      issue = 'Only shows toast; does not export CSV data or download file';
      doesWhat = 'Shows toast only';
    } else if (handlerName === 'exportGradebookCSV') {
      status = 'FAKE';
      issue = 'Only shows toast; does not export CSV data or download file';
      doesWhat = 'Shows toast only';
    } else if (handlerName === 'submitSupportTicket') {
      status = 'FAKE';
      issue = 'Only shows toast; does not write ticket to backend or audit_logs';
      doesWhat = 'Closes modal and shows toast';
    } else if (handlerName === 'testUnauthorizedRoleEdit') {
      status = 'WORKING'; // internal security test helper
      doesWhat = 'Runs client-side penetration test for RLS role tampering';
      realBackend = true;
    }
  }

  // Check buttons without onclick or listener
  if (item.tag === 'button' && !item.onclick && !item.id) {
    status = 'DEAD';
    issue = 'Button has no id and no onclick';
    doesWhat = 'None';
  } else if (item.tag === 'button' && !item.onclick && item.id) {
    const hasRef = jsPart.includes(item.id);
    if (!hasRef) {
      status = 'DEAD';
      issue = `Button #${item.id} has no click listener and no onclick`;
      doesWhat = 'None';
    } else {
      doesWhat = `Controlled via JS reference #${item.id}`;
    }
  }

  // Check links
  if (item.tag === 'a') {
    if (item.href === '#' || item.href === 'javascript:void(0)') {
      if (!item.onclick) {
        status = 'DEAD';
        issue = 'Anchor href="#" or javascript:void(0) without click handler';
      }
    }
  }

  audited.push({
    ...item,
    handlerName,
    doesWhat: doesWhat || 'Interactive control',
    realBackend,
    status,
    issue
  });
});

console.log('Audited elements count:', audited.length);
const statusCounts = audited.reduce((acc, el) => {
  acc[el.status] = (acc[el.status] || 0) + 1;
  return acc;
}, {});
console.log('Status counts:', statusCounts);

fs.writeFileSync('scripts/audited-inventory.json', JSON.stringify(audited, null, 2));
