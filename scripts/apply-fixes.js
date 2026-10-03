const fs = require('fs');

let content = fs.readFileSync('BrainzOS.html', 'utf8');

// 1. Remove Biometrics button
const bioBtnRegex = /<!-- Decorative Biometrics Button -->[\s\S]*?<button class="btn-secondary" id="biometric-btn"[\s\S]*?<\/button>/;
if (bioBtnRegex.test(content)) {
  content = content.replace(bioBtnRegex, '');
  console.log('✔ Removed biometric-btn markup');
} else {
  console.warn('⚠ Could not match biometric-btn markup');
}

// 2. Remove Biometrics overlay
const bioOverlayRegex = /<div class="biometric-overlay" id="biometric-overlay">[\s\S]*?<\/div>\s*<\/div>/;
if (bioOverlayRegex.test(content)) {
  content = content.replace(bioOverlayRegex, '');
  console.log('✔ Removed biometric-overlay markup');
} else {
  console.warn('⚠ Could not match biometric-overlay markup');
}

// 3. Remove startBiometricLogin function
const bioFuncRegex = /\/\*\*[\s\S]*?\* Biometric Login Shortcut[\s\S]*?function startBiometricLogin\(\) \{[\s\S]*?\n\}\n/;
if (bioFuncRegex.test(content)) {
  content = content.replace(bioFuncRegex, '');
  console.log('✔ Removed startBiometricLogin function');
} else {
  console.warn('⚠ Could not match startBiometricLogin function');
}

// 4. In Escape key handler, remove .biometric-overlay reference
content = content.replace(
  "document.querySelectorAll('.modal-overlay.active, .biometric-overlay.active')",
  "document.querySelectorAll('.modal-overlay.active')"
);

// 5. Add static #dash-promo-banner inside page-student-dashboard
if (!content.includes('id="dash-promo-banner"')) {
  const dashHeaderRegex = /(<section class="os-page active" id="page-student-dashboard">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>)/;
  content = content.replace(dashHeaderRegex, '$1\n<!-- Student Dashboard Academic Promotion Banner Placeholder -->\n<div id="dash-promo-banner" style="display:none; margin-bottom: 20px;"></div>');
  console.log('✔ Added static #dash-promo-banner placeholder');
}

// 6. Fix teacher assignments filter pills
const oldFilterPills = `<!-- Filter Pills -->
<div style="display: flex; gap: 8px; margin-bottom: 22px; overflow-x: auto; padding-bottom: 4px;">
<button class="btn-secondary" style="background: rgba(106, 142, 174, 0.14); border-color: var(--color-blue); font-weight: 600;">All Cohorts (5)</button>
<button class="btn-secondary">XI-B Commerce (3)</button>
<button class="btn-secondary">XI-A Commerce (2)</button>
<button class="btn-secondary">Grading Pending (28)</button>
</div>`;

const newFilterPills = `<!-- Filter Pills -->
<div style="display: flex; gap: 8px; margin-bottom: 22px; overflow-x: auto; padding-bottom: 4px;" id="teacher-asg-filter-bar">
<button class="btn-secondary asg-filter-pill active" id="asg-filter-all" onclick="filterTeacherAssignments('all', this)" style="background: rgba(106, 142, 174, 0.14); border-color: var(--color-blue); font-weight: 600;">All Cohorts (<span id="t-asg-count-all">0</span>)</button>
<button class="btn-secondary asg-filter-pill" id="asg-filter-xib" onclick="filterTeacherAssignments('XI-B', this)">XI-B Commerce (<span id="t-asg-count-xib">0</span>)</button>
<button class="btn-secondary asg-filter-pill" id="asg-filter-xia" onclick="filterTeacherAssignments('XI-A', this)">XI-A Commerce (<span id="t-asg-count-xia">0</span>)</button>
<button class="btn-secondary asg-filter-pill" id="asg-filter-pending" onclick="filterTeacherAssignments('pending', this)">Grading Pending (<span id="t-asg-count-pending">0</span>)</button>
</div>`;

if (content.includes(oldFilterPills)) {
  content = content.replace(oldFilterPills, newFilterPills);
  console.log('✔ Replaced static filter pills in page-teacher-assignments');
} else {
  console.warn('⚠ Could not match oldFilterPills');
}

// 7. Remove cursor: pointer from student clubs non-interactive badges
content = content.replace(
  '<span class="badge badge-blue" style="cursor: pointer;">Lab Schedule</span>',
  '<span class="badge badge-blue">Lab Schedule</span>'
);
content = content.replace(
  '<span class="badge badge-blue" style="cursor: pointer;">Portal Open</span>',
  '<span class="badge badge-blue">Portal Open</span>'
);
content = content.replace(
  '<span class="badge badge-beige" style="cursor: pointer;">Debate Schedule</span>',
  '<span class="badge badge-beige">Debate Schedule</span>'
);
console.log('✔ Removed misleading cursor:pointer from clubs badges');

// 8. Update renderAssignmentsList & add filterTeacherAssignments
const oldRenderAssignmentsList = `function renderAssignmentsList() {
  const container = document.getElementById('assignments-grid-container');
  if (!container) return;

  container.innerHTML = TEACHER_ASSIGNMENTS_DATA.map(a => \`
    <div class="assignment-card">
      <div class="assignment-card-header">
        <div>
          <span class="badge badge-blue" style="font-size: 0.65rem; margin-bottom: 6px;">\${escapeHtml(a.cohort)}</span>
          <h3 class="assignment-title">\${escapeHtml(a.title)}</h3>
          <span class="assignment-subject">\${escapeHtml(a.subject)}</span>
        </div>
        <span class="badge \${a.badge === 'Priority' ? 'badge-sage' : 'badge-beige'}">\${escapeHtml(a.badge)}</span>
      </div>

      <div class="progress-container">
        <div class="progress-labels">
          <span>Submission Progress</span>
          <span style="font-weight: 600; color: var(--color-ink);">\${escapeHtml(a.submissions)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: \${a.progress}%;"></div>
        </div>
      </div>

      <div class="assignment-footer">
        <span class="due-date">
          <i data-lucide="clock" style="width: 13px; height: 13px;" aria-hidden="true"></i>
          <span>Due: \${escapeHtml(a.due)}</span>
        </span>
        <button class="btn-secondary" style="padding: 6px 12px; font-size: var(--text-xs);" onclick="showToast('Roster Loaded', 'Viewing student submission attachments.')">
          Review (36)
        </button>
      </div>
    </div>
  \`).join('');

  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}`;

const newRenderAssignmentsList = `STATE.teacherAssignmentFilter = 'all';

function filterTeacherAssignments(filterType, btnEl) {
  STATE.teacherAssignmentFilter = filterType;
  document.querySelectorAll('.asg-filter-pill').forEach(b => {
    b.classList.remove('active');
    b.style.background = '';
    b.style.borderColor = '';
    b.style.fontWeight = '';
  });
  if (btnEl) {
    btnEl.classList.add('active');
    btnEl.style.background = 'rgba(106, 142, 174, 0.14)';
    btnEl.style.borderColor = 'var(--color-blue)';
    btnEl.style.fontWeight = '600';
  }
  renderAssignmentsList();
}

function renderAssignmentsList() {
  const container = document.getElementById('assignments-grid-container');
  if (!container) return;

  // Update dynamic count badges
  const countAll = TEACHER_ASSIGNMENTS_DATA.length;
  const countXIB = TEACHER_ASSIGNMENTS_DATA.filter(a => (a.cohort || '').includes('XI-B')).length;
  const countXIA = TEACHER_ASSIGNMENTS_DATA.filter(a => (a.cohort || '').includes('XI-A')).length;
  const countPending = TEACHER_ASSIGNMENTS_DATA.filter(a => (a.progress || 0) < 100).length;

  const elAll = document.getElementById('t-asg-count-all');
  if (elAll) elAll.textContent = countAll;
  const elXIB = document.getElementById('t-asg-count-xib');
  if (elXIB) elXIB.textContent = countXIB;
  const elXIA = document.getElementById('t-asg-count-xia');
  if (elXIA) elXIA.textContent = countXIA;
  const elPending = document.getElementById('t-asg-count-pending');
  if (elPending) elPending.textContent = countPending;

  // Filter according to active selection
  let filtered = TEACHER_ASSIGNMENTS_DATA;
  if (STATE.teacherAssignmentFilter === 'XI-B') {
    filtered = filtered.filter(a => (a.cohort || '').includes('XI-B'));
  } else if (STATE.teacherAssignmentFilter === 'XI-A') {
    filtered = filtered.filter(a => (a.cohort || '').includes('XI-A'));
  } else if (STATE.teacherAssignmentFilter === 'pending') {
    filtered = filtered.filter(a => (a.progress || 0) < 100);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--color-ink-subtle); grid-column: 1 / -1;">No coursework assignments found matching this filter.</div>';
    return;
  }

  container.innerHTML = filtered.map(a => \`
    <div class="assignment-card">
      <div class="assignment-card-header">
        <div>
          <span class="badge badge-blue" style="font-size: 0.65rem; margin-bottom: 6px;">\${escapeHtml(a.cohort)}</span>
          <h3 class="assignment-title">\${escapeHtml(a.title)}</h3>
          <span class="assignment-subject">\${escapeHtml(a.subject)}</span>
        </div>
        <span class="badge \${a.badge === 'Priority' ? 'badge-sage' : 'badge-beige'}">\${escapeHtml(a.badge)}</span>
      </div>

      <div class="progress-container">
        <div class="progress-labels">
          <span>Submission Progress</span>
          <span style="font-weight: 600; color: var(--color-ink);">\${escapeHtml(a.submissions)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: \${a.progress}%;"></div>
        </div>
      </div>

      <div class="assignment-footer">
        <span class="due-date">
          <i data-lucide="clock" style="width: 13px; height: 13px;" aria-hidden="true"></i>
          <span>Due: \${escapeHtml(a.due)}</span>
        </span>
        <button class="btn-secondary" style="padding: 6px 12px; font-size: var(--text-xs);" onclick="navigateTo('page-teacher-gradebook')">
          Review Roster
        </button>
      </div>
    </div>
  \`).join('');

  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}`;

if (content.includes(oldRenderAssignmentsList)) {
  content = content.replace(oldRenderAssignmentsList, newRenderAssignmentsList);
  console.log('✔ Updated renderAssignmentsList with real filtering and navigation');
} else {
  console.warn('⚠ Could not match oldRenderAssignmentsList');
}

// 9. Real CSV Export for Audit Logs
const oldExportAuditLogs = `function exportAuditLogsCSV() {
  showToast('Exporting Audit Ledger', 'Preparing cryptographic compliance CSV snapshot…', 'download');
}`;

const newExportAuditLogs = `function exportAuditLogsCSV() {
  if (!AUDIT_LOGS || AUDIT_LOGS.length === 0) {
    showToast('No Audit Logs', 'No activity records available to export.', 'info');
    return;
  }
  const headers = ['Timestamp', 'Actor', 'Action Description', 'Device'];
  const rows = AUDIT_LOGS.map(r => [
    \`"\${(r.time || '').replace(/"/g, '""')}"\`,
    \`"\${(r.actor || '').replace(/"/g, '""')}"\`,
    \`"\${(r.action || '').replace(/"/g, '""')}"\`,
    \`"\${(r.device || '').replace(/"/g, '""')}"\`
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = \`audit-logs-ledger-\${new Date().toISOString().split('T')[0]}.csv\`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  logAuditEvent('Exported cryptographic audit ledger CSV snapshot');
  showToast('Export Complete', 'Audit ledger snapshot downloaded.', 'download');
}`;

if (content.includes(oldExportAuditLogs)) {
  content = content.replace(oldExportAuditLogs, newExportAuditLogs);
  console.log('✔ Replaced exportAuditLogsCSV with real CSV download');
} else {
  console.warn('⚠ Could not match oldExportAuditLogs');
}

// 10. Real CSV Export for Gradebook
const oldExportGradebook = `function exportGradebookCSV() {
  showToast('Exporting Gradebook', 'Term 1 Continuous Assessment CSV compiled.', 'download');
}`;

const newExportGradebook = `function exportGradebookCSV() {
  if (!GRADEBOOK_DATA || GRADEBOOK_DATA.length === 0) {
    showToast('No Gradebook Data', 'No continuous assessment records available to export.', 'info');
    return;
  }
  const classSection = STATE.currentUser?.class_section || 'XI-B';
  const headers = ['Student ID', 'Student Name', 'Quiz (20)', 'Case Study (40)', 'Presentation (40)', 'Total (100)'];
  const rows = GRADEBOOK_DATA.map(s => {
    const total = (parseFloat(s.quiz) || 0) + (parseFloat(s.caseStudy) || 0) + (parseFloat(s.presentation) || 0);
    return [
      \`"\${(s.roll || '').replace(/"/g, '""')}"\`,
      \`"\${(s.name || '').replace(/"/g, '""')}"\`,
      s.quiz,
      s.caseStudy,
      s.presentation,
      total
    ];
  });
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = \`gradebook-\${classSection}-continuous-assessment.csv\`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  logAuditEvent(\`Exported Class \${classSection} Continuous Assessment Gradebook CSV\`);
  showToast('Export Complete', \`Gradebook assessment CSV for Class \${classSection} downloaded.\`, 'download');
}`;

if (content.includes(oldExportGradebook)) {
  content = content.replace(oldExportGradebook, newExportGradebook);
  console.log('✔ Replaced exportGradebookCSV with real CSV download');
} else {
  console.warn('⚠ Could not match oldExportGradebook');
}

// 11. Real Report Export for Executive Summary
const oldExportExec = `function exportExecutiveSummary() {
  logAuditEvent('Generated Term I Board of Trustees Executive Summary');
  showToast('Report Generated', 'Executive summary packet generated successfully.');
}`;

const newExportExec = `function exportExecutiveSummary() {
  const today = new Date().toISOString().split('T')[0];
  const report = [
    '# BrainzOS Institutional Executive Summary Packet',
    \`# Generated: \${new Date().toLocaleString()} (CBSE Computing Cluster)\`,
    \`# Authorized: Dr. Rhea Sharma (Director)\`,
    '',
    'METRIC,VALUE,STATUS',
    'Active Student Enrollment,1284,Verified',
    'Faculty On Duty,48,Active',
    'Campus Attendance Turnout,96.8%,Optimal',
    'Term 1 Continuous Assessment Submissions,92.4%,On Track',
    'CBSE Academic Compliance Index,100%,Compliant',
    '',
    'DEPARTMENT,ATTENDANCE TURNOUT,FACULTY STRENGTH',
    'Commerce & Economics,97.2%,14',
    'Science & Technology,96.5%,18',
    'Humanities & Social Sciences,96.1%,10',
    'Languages & Arts,97.5%,6'
  ].join('\\n');
  const blob = new Blob([report], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = \`board-of-trustees-executive-summary-\${today}.csv\`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  logAuditEvent('Generated and downloaded Term I Board of Trustees Executive Summary Packet');
  showToast('Report Downloaded', 'Board of Trustees Executive Summary CSV downloaded.', 'download');
}`;

if (content.includes(oldExportExec)) {
  content = content.replace(oldExportExec, newExportExec);
  console.log('✔ Replaced exportExecutiveSummary with real CSV download');
} else {
  console.warn('⚠ Could not match oldExportExec');
}

// 12. Real Faculty Dossier Print
const oldExportDossier = `function exportTeacherDossier() {
  logAuditEvent(\`Generated comprehensive faculty dossier for teacher \${STATE.selectedTeacherId}\`);
  showToast('Dossier Exported', 'Teacher performance dossier generated successfully.', 'printer');
}`;

const newExportDossier = `function exportTeacherDossier() {
  const teacherName = document.getElementById('td-name')?.textContent || 'Faculty Member';
  logAuditEvent(\`Printed comprehensive faculty dossier for \${teacherName} (\${STATE.selectedTeacherId})\`);
  showToast('Preparing Print View', 'Opening institutional dossier print preview…', 'printer');
  setTimeout(() => {
    window.print();
  }, 300);
}`;

if (content.includes(oldExportDossier)) {
  content = content.replace(oldExportDossier, newExportDossier);
  console.log('✔ Replaced exportTeacherDossier with print preview');
} else {
  console.warn('⚠ Could not match oldExportDossier');
}

// 13. Real Support Ticket Submission
const oldSubmitSupport = `function submitSupportTicket() {
  closeSupportModal();
  showToast('Support Request Dispatched', 'Campus IT Helpdesk ticket logged.');
}`;

const newSubmitSupport = `async function submitSupportTicket() {
  const noteInput = document.getElementById('support-quick-note');
  const note = noteInput ? noteInput.value.trim() : '';
  if (!note || note.length < 5) {
    showToast('Validation Error', 'Please describe the IT incident (minimum 5 characters).', 'alert-circle');
    if (noteInput) noteInput.focus();
    return;
  }
  const modal = document.getElementById('support-modal-overlay');
  const dispatchBtn = modal?.querySelector('button.btn-primary');
  if (dispatchBtn) {
    dispatchBtn.disabled = true;
    dispatchBtn.textContent = 'Dispatching…';
  }
  try {
    await logAuditEvent(\`Campus IT Helpdesk Ticket Logged: "\${note}"\`);
    if (noteInput) noteInput.value = '';
    closeSupportModal();
    const ticketId = 'HD-' + Math.floor(100000 + Math.random() * 900000);
    showToast('Support Request Dispatched', \`Campus IT Helpdesk ticket #\${ticketId} registered in institutional ledger.\`, 'check-circle');
  } catch (err) {
    showToast('Dispatch Error', err.message || 'Failed to dispatch support request.', 'alert-triangle');
  } finally {
    if (dispatchBtn) {
      dispatchBtn.disabled = false;
      dispatchBtn.innerHTML = '<i data-lucide="send" style="width: 15px; height: 15px;"></i><span>Dispatch Ticket</span>';
      if (window.lucide?.createIcons) window.lucide.createIcons();
    }
  }
}`;

if (content.includes(oldSubmitSupport)) {
  content = content.replace(oldSubmitSupport, newSubmitSupport);
  console.log('✔ Replaced submitSupportTicket with real validated audit logging');
} else {
  console.warn('⚠ Could not match oldSubmitSupport');
}

// 14. Command Palette Role Filtering in filterCommandResults
const oldFilterCmd = `  const filtered = allCommands.filter(c => c.title.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q));`;

const newFilterCmd = `  const userRole = STATE.currentUser?.role || 'student';
  const roleFiltered = allCommands.filter(c => {
    // Student restrictions
    if (userRole === 'student') {
      const allowedStudentTitles = [
        'Dashboard', 'Timetable', 'Assignments', 'Digital Pass',
        'Clubs & Houses', 'Student Dossier & Documents', 'Sign Out'
      ];
      return allowedStudentTitles.includes(c.title);
    }
    // Teacher restrictions
    if (userRole === 'teacher') {
      const directorOnlyTitles = [
        'Teachers', 'Teacher Profile', 'Faculty Management',
        'Staff Leave & Substitutions', 'Curriculum & Test Rollup',
        'Test Schedule Rollup', 'Audit Ledger'
      ];
      return !directorOnlyTitles.includes(c.title);
    }
    // Director has access to all operational commands
    return true;
  });

  const filtered = roleFiltered.filter(c => c.title.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q));`;

if (content.includes(oldFilterCmd)) {
  content = content.replace(oldFilterCmd, newFilterCmd);
  console.log('✔ Added role security filtering to filterCommandResults');
} else {
  console.warn('⚠ Could not match oldFilterCmd');
}

fs.writeFileSync('BrainzOS.html', content, 'utf8');
console.log('Done applying updates to BrainzOS.html');
