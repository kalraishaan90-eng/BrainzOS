const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'BrainzOS.html');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Static HTML text cleanups
content = content.replace(
  '<h1 id="dash-welcome-name">Welcome, Ishaan Kalra</h1>',
  '<h1 id="dash-welcome-name">Welcome</h1>'
);

content = content.replace(
  '<div class="pass-student-name">Ishaan Kalra</div>',
  '<div class="pass-student-name" id="pass-student-name-display">—</div>'
);

content = content.replace(
  '<p class="subtext">Signed as Aarav Mehta (Teacher)</p>',
  '<p class="subtext" id="pass-signed-teacher">Verified Institutional Faculty</p>'
);

content = content.replace(
  'placeholder="e.g. Ishaan Kalra"',
  'placeholder="e.g. Full Name"'
);
content = content.replace(
  'placeholder="e.g. Ishaan Kalra"',
  'placeholder="e.g. Full Name"'
);

content = content.replace(
  '<h1 id="td-name" style="font-family: var(--font-heading); font-size: 1.85rem; font-weight: 600; color: var(--color-ink);">Aarav Mehta</h1>',
  '<h1 id="td-name" style="font-family: var(--font-heading); font-size: 1.85rem; font-weight: 600; color: var(--color-ink);">Faculty Member</h1>'
);

content = content.replace(
  '<h1 id="sd-name" style="font-family: var(--font-heading); font-size: 1.85rem; font-weight: 600; color: var(--color-ink);">Ishaan Kalra</h1>',
  '<h1 id="sd-name" style="font-family: var(--font-heading); font-size: 1.85rem; font-weight: 600; color: var(--color-ink);">Student Scholar</h1>'
);

content = content.replace(
  '<strong id="sub-original-teacher-name" style="font-size: var(--text-sm); color: var(--color-ink);">Aarav Mehta</strong>',
  '<strong id="sub-original-teacher-name" style="font-size: var(--text-sm); color: var(--color-ink);">Faculty Member</strong>'
);

// 2. Fallbacks in JS code
content = content.split("'Aarav Mehta'").join("'Faculty Member'");
content = content.split('"Aarav Mehta"').join('"Faculty Member"');
content = content.split("'Dr. Rhea Sharma (Director)'").join("'School Director'");
content = content.split("'Dr. Rhea Sharma'").join("'School Director'");
content = content.split('"Dr. Rhea Sharma"').join('"School Director"');
content = content.split("'Ishaan Kalra'").join("'Student Scholar'");
content = content.split('"Ishaan Kalra"').join('"Student Scholar"');

// 3. Clear mock arrays
// Clear mock audit logs
const auditLogsRegex = /let AUDIT_LOGS_DATA = \[\s*\{[\s\S]*?\];/;
if (auditLogsRegex.test(content)) {
  content = content.replace(auditLogsRegex, 'let AUDIT_LOGS_DATA = [];');
  console.log('Cleared AUDIT_LOGS_DATA');
}

// Clear mock broadcasts
const broadcastsRegex = /let BROADCASTS_DATA = \[\s*\{[\s\S]*?\];/;
if (broadcastsRegex.test(content)) {
  content = content.replace(broadcastsRegex, 'let BROADCASTS_DATA = [];');
  console.log('Cleared BROADCASTS_DATA');
}

// Clear mock attendance records
const classAttendanceRegex = /let CLASS_ATTENDANCE = \[\s*\{[\s\S]*?\];/;
if (classAttendanceRegex.test(content)) {
  content = content.replace(classAttendanceRegex, 'let CLASS_ATTENDANCE = [];');
  console.log('Cleared CLASS_ATTENDANCE');
}

// Clear mock gradebook data
const gradebookRegex = /let GRADEBOOK_DATA = \[\s*\{[\s\S]*?\];/;
if (gradebookRegex.test(content)) {
  content = content.replace(gradebookRegex, 'let GRADEBOOK_DATA = [];');
  console.log('Cleared GRADEBOOK_DATA');
}

// Clear mock timetable entries
const timetableRegex = /let TIMETABLE_DATA = \[\s*\{[\s\S]*?\];/;
if (timetableRegex.test(content)) {
  content = content.replace(timetableRegex, 'let TIMETABLE_DATA = [];');
  console.log('Cleared TIMETABLE_DATA');
}

// Clear mock documents store
const docStoreRegex = /let DOCUMENTS_STORE = \[\s*\{[\s\S]*?\];/;
if (docStoreRegex.test(content)) {
  content = content.replace(docStoreRegex, 'let DOCUMENTS_STORE = [];');
  console.log('Cleared DOCUMENTS_STORE');
}

// Clear mock ventures
const venturesRegex = /let VENTURES_DATA = \[\s*\{[\s\S]*?\];/;
if (venturesRegex.test(content)) {
  content = content.replace(venturesRegex, 'let VENTURES_DATA = [];');
  console.log('Cleared VENTURES_DATA');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Finished mock data cleanup in BrainzOS.html');
