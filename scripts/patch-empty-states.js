const fs = require('fs');

let content = fs.readFileSync('BrainzOS.html', 'utf8');

// 1. ATTENDANCE_DATA empty
content = content.replace(
  /let ATTENDANCE_DATA = \[\s*\{ id: 'a0000000-0000-0000-0000-000000000001'[\s\S]*?\n\];/m,
  'let ATTENDANCE_DATA = [];'
);

// 2. TEACHER_ASSIGNMENTS_DATA empty
content = content.replace(
  /let TEACHER_ASSIGNMENTS_DATA = \[\s*\{ id: '44444444-4444-4444-4444-444444444401'[\s\S]*?\n\];/m,
  'let TEACHER_ASSIGNMENTS_DATA = [];'
);

// 3. AUDIT_LOGS empty
content = content.replace(
  /let AUDIT_LOGS = \[\s*\{ id: '1', time: '12:02:14'[\s\S]*?\n\];/m,
  'let AUDIT_LOGS = [];'
);

// 4. PERSON_DOCUMENTS_DATA empty
content = content.replace(
  /let PERSON_DOCUMENTS_DATA = \[\s*\/\/ Teacher Aarav Mehta documents[\s\S]*?\n\];/m,
  'let PERSON_DOCUMENTS_DATA = [];'
);

// 5. renderFacultyDirectory empty state
content = content.replace(
  /function renderFacultyDirectory\(\) \{\s*const tbody = document\.getElementById\('director-faculty-table-body'\);\s*if \(!tbody\) return;\s*tbody\.innerHTML = FACULTY_DIRECTORY\.map/m,
  `function renderFacultyDirectory() {
  const tbody = document.getElementById('director-faculty-table-body');
  if (!tbody) return;
  if (!FACULTY_DIRECTORY || FACULTY_DIRECTORY.length === 0) {
    tbody.innerHTML = \`
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: var(--color-ink-subtle);">
          <i data-lucide="users" style="width: 32px; height: 32px; display: inline-block; margin-bottom: 12px; color: var(--color-blue); opacity: 0.6;"></i>
          <div style="font-weight: 600; color: var(--color-ink); font-size: var(--text-base);">No Faculty Members Found</div>
          <div style="font-size: var(--text-xs); margin-top: 4px; color: var(--color-ink-muted);">Provision teachers using the Teacher Roster page or the provisioning script.</div>
        </td>
      </tr>
    \`;
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    return;
  }
  tbody.innerHTML = FACULTY_DIRECTORY.map`
);

// 6. filterTeacherRoster empty state
content = content.replace(
  /if \(filtered\.length === 0\) \{\s*tbody\.innerHTML = `\s*<tr>\s*<td colspan="6" style="text-align: center; padding: 24px; color: var\(--color-ink-subtle\);">\s*No teachers found matching "\$\{escapeHtml\(searchVal\)\}"\.\s*<\/td>\s*<\/tr>\s*`;\s*return;\s*\}/m,
  `if (filtered.length === 0) {
    const emptyMsg = searchVal ? \`No teachers found matching "\${escapeHtml(searchVal)}".\` : 'No teachers provisioned yet. Click "Add Teacher" above to provision the first faculty account.';
    tbody.innerHTML = \`
      <tr>
        <td colspan="6" style="text-align: center; padding: 36px; color: var(--color-ink-subtle);">
          <i data-lucide="user-check" style="width: 28px; height: 28px; display: inline-block; margin-bottom: 8px; color: var(--color-blue); opacity: 0.6;"></i>
          <div style="font-weight: 600; color: var(--color-ink);">\${emptyMsg}</div>
        </td>
      </tr>
    \`;
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    return;
  }`
);

// 7. renderAttendanceReportsTable empty state
content = content.replace(
  /function renderAttendanceReportsTable\(role, tbodyId, data, selectedDate\) \{\s*const tbody = document\.getElementById\(tbodyId\);\s*if \(!tbody\) return;\s*const isToday = selectedDate === new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\];\s*const isLocked = isToday \? STATE\.isAttendanceLocked : true;\s*tbody\.innerHTML = data\.map/m,
  `function renderAttendanceReportsTable(role, tbodyId, data, selectedDate) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = \`
      <tr>
        <td colspan="\${role === 'director' ? 8 : 7}" style="text-align: center; padding: 36px; color: var(--color-ink-subtle);">
          <i data-lucide="calendar" style="width: 28px; height: 28px; display: inline-block; margin-bottom: 10px; color: var(--color-sage); opacity: 0.8;"></i>
          <div style="font-weight: 600; color: var(--color-ink); font-size: var(--text-sm);">No Attendance Recorded for this Date</div>
          <div style="font-size: var(--text-xs); margin-top: 4px; color: var(--color-ink-muted);">Attendance register entries for \${escapeHtml(selectedDate)} have not been submitted yet.</div>
        </td>
      </tr>
    \`;
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    return;
  }

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const isLocked = isToday ? STATE.isAttendanceLocked : true;

  tbody.innerHTML = data.map`
);

// 8. fetchDirectorLeaveOverview: remove fake summaryRows fallback
content = content.replace(
  /if \(summaryRows\.length === 0\) \{\s*summaryRows = \[\s*\{ teacher_name: 'Faculty Member', employee_code: 'FAC-COMM-01'[\s\S]*?\n\s*\];\s*\}/m,
  `if (summaryRows.length === 0) {
      summaryTbody.innerHTML = \`
        <tr>
          <td colspan="6" style="text-align: center; padding: 32px; color: var(--color-ink-subtle);">
            <i data-lucide="inbox" style="width: 24px; height: 24px; display: inline-block; margin-bottom: 8px; color: var(--color-sage); opacity: 0.7;"></i>
            <div style="font-weight: 600; color: var(--color-ink); font-size: var(--text-sm);">No Faculty Leave Summary Records</div>
            <div style="font-size: var(--text-xs); margin-top: 4px; color: var(--color-ink-muted);">Leave balances and taken days will accumulate as teachers apply for leave.</div>
          </td>
        </tr>
      \`;
    } else {
      summaryTbody.innerHTML = summaryRows.map(s => \`
        <tr>
          <td><strong>\${escapeHtml(s.teacher_name)}</strong></td>
          <td><code style="font-size: 11px;">\${escapeHtml(s.employee_code || '—')}</code></td>
          <td><span class="badge badge-beige">\${s.full_day_leaves} days</span></td>
          <td><span class="badge badge-beige">\${s.half_day_leaves} half-days</span></td>
          <td><strong style="color: var(--color-ink);">\${s.total_leave_days_taken} days</strong></td>
          <td><span class="badge \${s.pending_requests_count > 0 ? 'badge-amber' : 'badge-sage'}">\${s.pending_requests_count} pending</span></td>
        </tr>
      \`).join('');
    }`
);

// Also remove duplicate summaryTbody.innerHTML mapping right below it if present
content = content.replace(
  /summaryTbody\.innerHTML = summaryRows\.map\(s => `\s*<tr>\s*<td><strong>\$\{escapeHtml\(s\.teacher_name\)\}<\/strong><\/td>\s*<td><code style="font-size: 11px;">\$\{escapeHtml\(s\.employee_code \|\| '—'\)\}<\/code><\/td>\s*<td><span class="badge badge-beige">\$\{s\.full_day_leaves\} days<\/span><\/td>\s*<td><span class="badge badge-beige">\$\{s\.half_day_leaves\} half-days<\/span><\/td>\s*<td><strong style="color: var\(--color-ink\);">\$\{s\.total_leave_days_taken\} days<\/strong><\/td>\s*<td><span class="badge \$\{s\.pending_requests_count > 0 \? 'badge-amber' : 'badge-sage'\}">\$\{s\.pending_requests_count\} pending<\/span><\/td>\s*<\/tr>\s*`\)\.join\(''\);\s*\}/m,
  '}'
);

// 9. fetchDirectorLeaveOverview: requestsTbody empty state
content = content.replace(
  /if \(requestsTbody\) \{\s*requestsTbody\.innerHTML = LEAVE_RECORDS_DATA\.map/m,
  `if (requestsTbody) {
    if (!LEAVE_RECORDS_DATA || LEAVE_RECORDS_DATA.length === 0) {
      requestsTbody.innerHTML = \`
        <tr>
          <td colspan="6" style="text-align: center; padding: 32px; color: var(--color-ink-subtle);">
            <i data-lucide="check-circle" style="width: 24px; height: 24px; display: inline-block; margin-bottom: 8px; color: var(--color-sage); opacity: 0.8;"></i>
            <div style="font-weight: 600; color: var(--color-ink); font-size: var(--text-sm);">All Caught Up</div>
            <div style="font-size: var(--text-xs); margin-top: 4px; color: var(--color-ink-muted);">No pending faculty leave applications in the approval queue.</div>
          </td>
        </tr>
      \`;
    } else {
      requestsTbody.innerHTML = LEAVE_RECORDS_DATA.map`
);
content = content.replace(
  /\.join\(''\);\s*\}\s*\/\/ Refresh icons across tab\s*if \(window\.lucide/m,
  `.join('');
    }
  }

  // Refresh icons across tab
  if (window.lucide`
);

// 10. fetchTeacherLeaveHistory empty state
content = content.replace(
  /function fetchTeacherLeaveHistory\(\) \{\s*const tbody = document\.getElementById\('teacher-leave-history-tbody'\);\s*if \(!tbody\) return;\s*let records = LEAVE_RECORDS_DATA\.filter\(lr => lr\.teacher_id === \(STATE\.currentUser\?\.id \|\| 'a0000000-0000-0000-0000-000000000002'\)\);/m,
  `function fetchTeacherLeaveHistory() {
  const tbody = document.getElementById('teacher-leave-history-tbody');
  if (!tbody) return;

  let records = LEAVE_RECORDS_DATA.filter(lr => lr.teacher_id === (STATE.currentUser?.id || ''));`
);

content = content.replace(
  /tbody\.innerHTML = records\.map\(r => \{\s*const typeLabel = r\.leave_type === 'full_day'/m,
  `if (!records || records.length === 0) {
    tbody.innerHTML = \`
      <tr>
        <td colspan="4" style="text-align: center; padding: 32px; color: var(--color-ink-subtle);">
          <i data-lucide="calendar" style="width: 24px; height: 24px; display: inline-block; margin-bottom: 8px; color: var(--color-sage); opacity: 0.7;"></i>
          <div style="font-weight: 600; color: var(--color-ink); font-size: var(--text-sm);">No Leave Applications Submitted</div>
          <div style="font-size: var(--text-xs); margin-top: 4px; color: var(--color-ink-muted);">Use the form above to submit a new leave request.</div>
        </td>
      </tr>
    \`;
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    return;
  }

  tbody.innerHTML = records.map(r => {
    const typeLabel = r.leave_type === 'full_day'`
);

// 11. fetchTeacherPlanner: tests empty state
content = content.replace(
  /if \(testListEl\) \{\s*testListEl\.innerHTML = tests\.map\(t => `/m,
  `if (testListEl) {
    if (!tests || tests.length === 0) {
      testListEl.innerHTML = \`
        <div style="padding: 24px; text-align: center; color: var(--color-ink-subtle); font-size: var(--text-sm); font-style: italic;">
          No tests scheduled yet.
        </div>
      \`;
    } else {
      testListEl.innerHTML = tests.map(t => \``
);
content = content.replace(
  /`\)\.join\(''\);\s*\}\s*if \(window\.lucide && window\.lucide\.createIcons\) window\.lucide\.createIcons\(\);\s*\}\s*async function handleCreateLecturePlan/m,
  `\`).join('');
    }
  }

  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

async function handleCreateLecturePlan`
);

// 12. fetchDirectorPlanner: tests empty state
content = content.replace(
  /if \(testsTbody\) \{\s*testsTbody\.innerHTML = tests\.map\(t => `/m,
  `if (testsTbody) {
    if (!tests || tests.length === 0) {
      testsTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--color-ink-subtle); padding:24px;">No upcoming tests scheduled for this cohort.</td></tr>';
    } else {
      testsTbody.innerHTML = tests.map(t => \``
);
content = content.replace(
  /`\)\.join\(''\);\s*\}\s*if \(window\.lucide && window\.lucide\.createIcons\) window\.lucide\.createIcons\(\);\s*\}\s*\/\*\*\s*\* 5\.5 DIRECTOR LEAVE/m,
  `\`).join('');
    }
  }

  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

/**
 * 5.5 DIRECTOR LEAVE`
);

// 13. renderAttendanceTable empty state
content = content.replace(
  /function renderAttendanceTable\(\) \{\s*const tbody = document\.getElementById\('attendance-tbody'\);\s*if \(!tbody\) return;\s*tbody\.innerHTML = '';\s*let presentCount = 0;/m,
  `function renderAttendanceTable() {
  const tbody = document.getElementById('attendance-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!ATTENDANCE_DATA || ATTENDANCE_DATA.length === 0) {
    tbody.innerHTML = \`
      <tr>
        <td colspan="4" style="text-align: center; padding: 36px; color: var(--color-ink-subtle);">
          <i data-lucide="users" style="width: 28px; height: 28px; display: inline-block; margin-bottom: 8px; color: var(--color-blue); opacity: 0.6;"></i>
          <div style="font-weight: 600; color: var(--color-ink); font-size: var(--text-sm);">No Students Enrolled in this Cohort</div>
          <div style="font-size: var(--text-xs); margin-top: 4px; color: var(--color-ink-muted);">Import or assign students to this class section to record attendance.</div>
        </td>
      </tr>
    \`;
    const pEl = document.getElementById('count-present-val');
    const lEl = document.getElementById('count-late-val');
    const aEl = document.getElementById('count-absent-val');
    if (pEl) pEl.textContent = '0';
    if (lEl) lEl.textContent = '0';
    if (aEl) aEl.textContent = '0';
    updateOverviewAttendanceTelemetry(0, 0);
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    return;
  }

  let presentCount = 0;`
);

// 14. populateAssigneeStudentsList: remove mock students
content = content.replace(
  /\/\/ Available students in cohort\s*const students = \(cohort\.includes\('XI-B'\) && ATTENDANCE_DATA && ATTENDANCE_DATA\.length > 0\)\s*\? ATTENDANCE_DATA\.map\(s => \(\{ id: s\.id, name: s\.name, roll: s\.roll \}\)\)\s*: \[\s*\{ id: 'a0000000-0000-0000-0000-000000000001', name: 'Student Scholar', roll: '1102-01' \}[\s\S]*?\n\s*\];/m,
  `const students = (cohort.includes('XI-B') && ATTENDANCE_DATA && ATTENDANCE_DATA.length > 0)
    ? ATTENDANCE_DATA.map(s => ({ id: s.id, name: s.name, roll: s.roll }))
    : [];

  if (students.length === 0) {
    container.innerHTML = '<div style="padding: 12px; color: var(--color-ink-subtle); font-size: var(--text-xs); font-style: italic;">No students enrolled in this cohort yet.</div>';
    return;
  }`
);

// 15. fetchStudentResults: remove CBSE 4-terms mock array fallback
content = content.replace(
  /\/\/ Institutional CBSE 4-terms assessment results\s*if \(!results \|\| results\.length === 0\) \{\s*results = \[\s*\/\/ Term 1: Unit Test - 1 \(25 Max\)[\s\S]*?Applied Mathematics', term: 'Unit Test - 2', marks_obtained: 22, max_marks: 25 \},\s*\];\s*\}/m,
  `if (!results) {
      results = [];
    }`
);

// 16. renderFinalMarksTable empty state
content = content.replace(
  /FINAL_MARKS_STATE\.students = \(students && students\.length > 0\) \? students : \[\s*\{ id: 'a0000000-0000-0000-0000-000000000001', full_name: 'Student Scholar' \}[\s\S]*?\n\s*\];/m,
  `FINAL_MARKS_STATE.students = (students && students.length > 0) ? students : [];`
);

content = content.replace(
  /const maxMarks = FINAL_MARKS_STATE\.maxMarks;\s*const locked   = FINAL_MARKS_STATE\.yearStatus !== 'active';\s*tbody\.innerHTML = FINAL_MARKS_STATE\.students\.map/m,
  `if (FINAL_MARKS_STATE.students.length === 0) {
    tbody.innerHTML = \`
      <tr>
        <td colspan="5" style="text-align: center; padding: 36px; color: var(--color-ink-subtle);">
          <i data-lucide="users" style="width: 28px; height: 28px; display: inline-block; margin-bottom: 8px; color: var(--color-blue); opacity: 0.6;"></i>
          <div style="font-weight: 600; color: var(--color-ink); font-size: var(--text-sm);">No Students Found in this Class Section</div>
          <div style="font-size: var(--text-xs); margin-top: 4px; color: var(--color-ink-muted);">Enrolled students will appear here for mark entry.</div>
        </td>
      </tr>
    \`;
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    return;
  }

  const maxMarks = FINAL_MARKS_STATE.maxMarks;
  const locked   = FINAL_MARKS_STATE.yearStatus !== 'active';

  tbody.innerHTML = FINAL_MARKS_STATE.students.map`
);

// 17. fetchAndRenderPersonDocuments: remove fallback generic docs
content = content.replace(
  /\/\/ Fallback generic docs if still empty\s*if \(docs\.length === 0\) \{\s*docs = \[\s*\{\s*id: 'doc-auto-' \+ ownerId\.substring\(0, 8\)[\s\S]*?\n\s*\}\s*\];\s*\}/m,
  `if (docs.length === 0) {
    tbody.innerHTML = \`
      <tr>
        <td colspan="5" style="text-align: center; padding: 28px; color: var(--color-ink-subtle);">
          <i data-lucide="file" style="width: 24px; height: 24px; display: inline-block; margin-bottom: 8px; color: var(--color-ink-muted); opacity: 0.5;"></i>
          <div style="font-weight: 500; font-size: var(--text-sm); color: var(--color-ink);">No Documents Uploaded</div>
          <div style="font-size: var(--text-xs); margin-top: 2px; color: var(--color-ink-muted);">Verified dossiers and certificates will appear here once uploaded.</div>
        </td>
      </tr>
    \`;
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    return;
  }`
);

// 18. Clean up mock names in text
content = content.replace("<!-- House 2: Nalanda (Blue) - Ishaan's House -->", "<!-- House 2: Nalanda (Blue) -->");
content = content.replace("Rank #2 · Ishaan's House", "Rank #2 · Nalanda House");
content = content.replace("Welcome back, Aarav. Here is your daily instructional pulse and live classroom telemetry.", "Welcome back. Here is your daily instructional pulse and live classroom telemetry.");
content = content.replace("if (entry.actor.includes('Dr. Rhea') || entry.actor.includes('Director'))", "if (entry.actor.toLowerCase().includes('director'))");
content = content.replace("Room 112 · Mrs. Sunita Sharma · Ledger Balancing &amp; Journal Entries", "Room 112 · Faculty Member · Ledger Balancing &amp; Journal Entries");

fs.writeFileSync('BrainzOS.html', content, 'utf8');
console.log('BrainzOS.html empty states and mock cleanups applied successfully.');
