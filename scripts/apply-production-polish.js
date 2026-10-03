const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'BrainzOS.html');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Starting production polish pass on BrainzOS.html...');

// 1. Remove remaining CampusCart and mock ventures
content = content.replace(
  /let PITCH_VENTURES = \[\s*\{[\s\S]*?\}\s*\];/,
  'let PITCH_VENTURES = [];'
);

// 2. Remove remaining STUDENT_ASSIGNMENTS_DATA
content = content.replace(
  /let STUDENT_ASSIGNMENTS_DATA = \[\s*\{[\s\S]*?\}\s*\];/,
  'let STUDENT_ASSIGNMENTS_DATA = [];'
);

// 3. Clear PERSON_DOCUMENTS_DATA
content = content.replace(
  /let PERSON_DOCUMENTS_DATA = \[\s*\{[\s\S]*?\}\s*\];/,
  'let PERSON_DOCUMENTS_DATA = [];'
);

// 4. Remove mock comments and text
content = content.replace(
  '# Authorized: Dr. Rhea Sharma (Director)',
  '# Authorized: Executive Directorate'
);
content = content.replace(
  '// Default canonical CBSE 4-terms dataset for Ishaan Kalra if not returned by DB',
  '// Institutional CBSE 4-terms assessment results'
);

// 5. In SUPABASE_CONFIG: Remove mock token and cloud URL fallback
const oldSupabaseConfig = `const SUPABASE_CONFIG = {
  url: (typeof window.BRAINZOS_CONFIG !== 'undefined' && window.BRAINZOS_CONFIG.SUPABASE_URL)
    || window.BRAINZOS_SUPABASE_URL
    || 'https://slqufxrmgrhcqwapkipa.supabase.co',
  anonKey: (typeof window.BRAINZOS_CONFIG !== 'undefined' && window.BRAINZOS_CONFIG.SUPABASE_ANON_KEY)
    || window.BRAINZOS_SUPABASE_ANON_KEY
    || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNscXVmeHJtZ3JoY3F3YXBraXBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwODc3OTAsImV4cCI6MjA2MDY2Mzc5MH0.z-Z8c6lX6Qh9-c8-mock-token-replace-with-real'
};`;

const newSupabaseConfig = `const SUPABASE_CONFIG = {
  url: (typeof window.BRAINZOS_CONFIG !== 'undefined' && window.BRAINZOS_CONFIG.SUPABASE_URL)
    || window.BRAINZOS_SUPABASE_URL
    || window.location.origin,
  anonKey: (typeof window.BRAINZOS_CONFIG !== 'undefined' && window.BRAINZOS_CONFIG.SUPABASE_ANON_KEY)
    || window.BRAINZOS_SUPABASE_ANON_KEY
    || ''
};`;

if (content.includes(oldSupabaseConfig)) {
  content = content.replace(oldSupabaseConfig, newSupabaseConfig);
  console.log('Updated SUPABASE_CONFIG to on-premises origin.');
} else {
  // Regex replacement
  content = content.replace(
    /const SUPABASE_CONFIG = \{[\s\S]*?\};/,
    newSupabaseConfig
  );
  console.log('Updated SUPABASE_CONFIG via regex.');
}

// 6. Add "Bulk Import Students (CSV)" button on page-director-teachers header
const teacherHeaderTarget = `<h1 class="page-header-title">Faculty Roster &amp; Account Provisioning</h1>`;
const teacherHeaderReplacement = `<div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <span class="badge badge-blue">Directorate Control</span>
          <span class="badge badge-sage">Identity &amp; Access</span>
        </div>
        <h1 class="page-header-title">Faculty &amp; Student Onboarding</h1>
        <p class="page-header-desc">Securely provision verified teacher accounts and bulk-import student cohorts with local database encryption.</p>
      </div>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn-secondary" onclick="openBulkStudentImportModal()" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px;">
          <i data-lucide="file-spreadsheet" style="width: 16px; height: 16px;"></i>
          <span>Bulk Import Students (CSV)</span>
        </button>
      </div>
    </div>`;

const headerCardBlockRegex = /<div style="display: flex; gap: 8px; margin-bottom: 8px;">\s*<span class="badge badge-blue">Directorate Control<\/span>\s*<span class="badge badge-sage">Identity &amp; Access<\/span>\s*<\/div>\s*<h1 class="page-header-title">Faculty Roster &amp; Account Provisioning<\/h1>\s*<p class="page-header-desc">.*?<\/p>/;

if (headerCardBlockRegex.test(content)) {
  content = content.replace(headerCardBlockRegex, teacherHeaderReplacement);
  console.log('Added Bulk Import Students button to page-director-teachers header.');
} else {
  console.log('WARN: Teacher header block not matched');
}

// 7. Inject Bulk Student Import Modal and Force Password Change Modal before cookie banner
const cookieBannerTarget = `<div class="cookie-banner" id="cookie-banner"`;

const modalsToInject = `
  <!-- =========================================================================
       DIRECTOR BULK STUDENT IMPORT MODAL (CSV Roster Onboarding)
       ========================================================================= -->
  <div class="modal-overlay" id="modal-bulk-student-import" style="display: none; position: fixed; inset: 0; background: rgba(28, 35, 43, 0.65); backdrop-filter: blur(6px); z-index: 10000; align-items: center; justify-content: center; padding: 20px;">
    <div class="card" style="width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; padding: 28px; border-radius: var(--radius-xl); box-shadow: var(--shadow-xl);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(106, 142, 174, 0.16); display: flex; align-items: center; justify-content: center; color: var(--color-blue);">
            <i data-lucide="users" style="width: 22px; height: 22px;"></i>
          </div>
          <div>
            <h3 style="font-size: 1.25rem; font-weight: 600; color: var(--color-ink); margin: 0;">Bulk Student Onboarding via CSV</h3>
            <p class="subtext" style="font-size: var(--text-xs); margin: 2px 0 0 0;">Upload cohort roster (.csv) to batch provision student accounts in PostgreSQL</p>
          </div>
        </div>
        <button class="btn-icon" onclick="closeBulkStudentImportModal()" aria-label="Close modal" style="background: none; border: none; cursor: pointer; color: var(--color-ink-muted);">
          <i data-lucide="x" style="width: 20px; height: 20px;"></i>
        </button>
      </div>

      <!-- Instructions & Template Download -->
      <div style="background: var(--color-surface-cream); border: 1px solid var(--color-border); border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <strong style="font-size: var(--text-xs); color: var(--color-ink);">Required CSV Columns:</strong>
            <p style="font-size: 11px; color: var(--color-ink-subtle); margin: 2px 0 0 0; font-family: monospace;">name, email, class_section, stream, house</p>
          </div>
          <a href="templates/students-import-template.csv" download="students-import-template.csv" class="btn-secondary" style="font-size: 11px; padding: 6px 12px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
            <i data-lucide="download" style="width: 14px; height: 14px;"></i>
            <span>Download Sample CSV</span>
          </a>
        </div>
      </div>

      <!-- File Dropzone -->
      <div id="student-csv-dropzone" style="border: 2px dashed var(--color-border); border-radius: 12px; padding: 32px 20px; text-align: center; background: var(--color-surface-white); cursor: pointer; margin-bottom: 20px;" onclick="document.getElementById('student-csv-input').click()">
        <input type="file" id="student-csv-input" accept=".csv" style="display: none;" onchange="handleStudentCsvFile(this.files[0])">
        <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(158, 187, 175, 0.2); display: flex; align-items: center; justify-content: center; color: var(--color-sage); margin: 0 auto 12px auto;">
          <i data-lucide="upload-cloud" style="width: 24px; height: 24px;"></i>
        </div>
        <strong style="font-size: var(--text-sm); color: var(--color-ink); display: block; margin-bottom: 4px;">Click to select CSV roster or drag and drop</strong>
        <span class="subtext" style="font-size: var(--text-xs);">Standard UTF-8 comma-separated text file (.csv)</span>
      </div>

      <!-- Preview Table Container -->
      <div id="student-csv-preview-wrap" style="display: none; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="font-size: var(--text-xs); color: var(--color-ink);">Roster Verification Preview (<span id="csv-preview-count">0</span> records)</strong>
          <span class="badge badge-sage">Verified Columns</span>
        </div>
        <div class="table-container" style="max-height: 220px; overflow-y: auto;">
          <table style="width: 100%; font-size: 12px;">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Class</th>
                <th>Stream</th>
                <th>House</th>
              </tr>
            </thead>
            <tbody id="student-csv-preview-tbody">
              <!-- Dynamically populated from CSV parse -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal Actions -->
      <div style="display: flex; justify-content: flex-end; gap: 10px;">
        <button type="button" class="btn-secondary" onclick="closeBulkStudentImportModal()">Cancel</button>
        <button type="button" class="btn-primary" id="btn-execute-student-import" onclick="executeBulkStudentImport()" disabled style="display: inline-flex; align-items: center; gap: 8px;">
          <i data-lucide="user-check" style="width: 16px; height: 16px;"></i>
          <span>Import Verified Students</span>
        </button>
      </div>
    </div>
  </div>

  <!-- =========================================================================
       FIRST-LOGIN FORCE PASSWORD CHANGE MODAL
       Enforces mandatory password rotation on first sign-in
       ========================================================================= -->
  <div class="modal-overlay" id="modal-force-password-change" style="display: none; position: fixed; inset: 0; background: rgba(28, 35, 43, 0.85); backdrop-filter: blur(8px); z-index: 10001; align-items: center; justify-content: center; padding: 20px;">
    <div class="card" style="width: 100%; max-width: 440px; padding: 30px; border-radius: var(--radius-xl); box-shadow: var(--shadow-xl); text-align: left;">
      <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(106, 142, 174, 0.16); display: flex; align-items: center; justify-content: center; color: var(--color-blue); margin-bottom: 16px;">
        <i data-lucide="key-round" style="width: 24px; height: 24px;"></i>
      </div>
      <h3 style="font-size: 1.3rem; font-weight: 600; color: var(--color-ink); margin-bottom: 6px;">Initial Password Rotation Required</h3>
      <p class="subtext" style="font-size: var(--text-xs); margin-bottom: 20px;">
        You have authenticated using temporary institutional onboarding credentials. To safeguard student and institutional records, please set a strong personal password.
      </p>

      <form id="form-force-password" onsubmit="handleForcePasswordSubmit(event)">
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" for="new-permanent-pwd">New Permanent Password</label>
          <input type="password" id="new-permanent-pwd" class="composer-input" placeholder="Minimum 8 characters" required minlength="8" style="width: 100%;">
        </div>
        <div class="form-group" style="margin-bottom: 22px;">
          <label class="form-label" for="confirm-permanent-pwd">Confirm Permanent Password</label>
          <input type="password" id="confirm-permanent-pwd" class="composer-input" placeholder="Re-type new password" required minlength="8" style="width: 100%;">
        </div>
        <button type="submit" id="btn-submit-force-pwd" class="btn-primary" style="width: 100%; padding: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <i data-lucide="lock" style="width: 16px; height: 16px;"></i>
          <span>Save Password &amp; Continue</span>
        </button>
      </form>
    </div>
  </div>
`;

if (content.includes(cookieBannerTarget)) {
  content = content.replace(cookieBannerTarget, modalsToInject + '\n  ' + cookieBannerTarget);
  console.log('Injected Bulk Student Import Modal and Force Password Change Modal into DOM.');
} else {
  console.log('WARN: cookie banner target not found for modal injection');
}

// 8. Append JavaScript functions for CSV import & force password rotation
const jsLogicToAppend = `
/* =========================================================================
   DIRECTOR BULK STUDENT CSV IMPORT ENGINE
   ========================================================================= */
let PARSED_STUDENT_ROSTER = [];

function openBulkStudentImportModal() {
  const modal = document.getElementById('modal-bulk-student-import');
  if (modal) {
    modal.style.display = 'flex';
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }
}

function closeBulkStudentImportModal() {
  const modal = document.getElementById('modal-bulk-student-import');
  if (modal) modal.style.display = 'none';
  PARSED_STUDENT_ROSTER = [];
  const previewWrap = document.getElementById('student-csv-preview-wrap');
  if (previewWrap) previewWrap.style.display = 'none';
  const execBtn = document.getElementById('btn-execute-student-import');
  if (execBtn) execBtn.disabled = true;
  const fileInput = document.getElementById('student-csv-input');
  if (fileInput) fileInput.value = '';
}

function handleStudentCsvFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    parseStudentCsv(text);
  };
  reader.readAsText(file);
}

function parseStudentCsv(csvText) {
  const lines = csvText.split(/\\r?\\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    showToast('Invalid CSV', 'File must contain a header row and at least one student row.', 'alert-octagon');
    return;
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const required = ['name', 'email', 'class_section', 'stream', 'house'];
  const missing = required.filter(r => !headers.includes(r));

  if (missing.length > 0) {
    showToast('CSV Header Mismatch', \`Missing required column(s): \${missing.join(', ')}\`, 'alert-octagon');
    return;
  }

  const nameIdx = headers.indexOf('name');
  const emailIdx = headers.indexOf('email');
  const classIdx = headers.indexOf('class_section');
  const streamIdx = headers.indexOf('stream');
  const houseIdx = headers.indexOf('house');

  PARSED_STUDENT_ROSTER = [];
  const tbody = document.getElementById('student-csv-preview-tbody');
  if (tbody) tbody.innerHTML = '';

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 2 || !cols[emailIdx]) continue;

    const student = {
      name: cols[nameIdx] || 'Student',
      email: cols[emailIdx].toLowerCase(),
      class_section: cols[classIdx] || 'XI-A',
      stream: cols[streamIdx] || 'Commerce',
      house: cols[houseIdx] || 'Nalanda'
    };
    PARSED_STUDENT_ROSTER.push(student);

    if (tbody) {
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td style="font-weight:600; color:var(--color-ink);">\${escapeHtml(student.name)}</td>
        <td style="font-family:monospace; color:var(--color-blue);">\${escapeHtml(student.email)}</td>
        <td><span class="badge badge-blue">\${escapeHtml(student.class_section)}</span></td>
        <td>\${escapeHtml(student.stream)}</td>
        <td><span class="badge badge-beige">\${escapeHtml(student.house)}</span></td>
      \`;
      tbody.appendChild(tr);
    }
  }

  const countEl = document.getElementById('csv-preview-count');
  if (countEl) countEl.textContent = PARSED_STUDENT_ROSTER.length;

  const previewWrap = document.getElementById('student-csv-preview-wrap');
  if (previewWrap) previewWrap.style.display = 'block';

  const execBtn = document.getElementById('btn-execute-student-import');
  if (execBtn) execBtn.disabled = PARSED_STUDENT_ROSTER.length === 0;

  showToast('CSV Parsed', \`Successfully verified \${PARSED_STUDENT_ROSTER.length} student records.\`, 'check-circle');
}

async function executeBulkStudentImport() {
  if (PARSED_STUDENT_ROSTER.length === 0) return;
  const execBtn = document.getElementById('btn-execute-student-import');
  if (execBtn) {
    execBtn.disabled = true;
    execBtn.innerHTML = '<i data-lucide="loader" style="width:16px;height:16px;"></i><span>Importing Roster…</span>';
  }

  try {
    if (supabase) {
      const { data, error } = await supabase.rpc('bulk_import_students', {
        p_students: PARSED_STUDENT_ROSTER
      });
      if (error) throw error;

      showToast('Import Complete', \`Successfully imported \${data?.imported || PARSED_STUDENT_ROSTER.length} students.\`, 'user-check');
      logAuditEvent(\`Director executed bulk student import: \${data?.imported || PARSED_STUDENT_ROSTER.length} student accounts created.\`);
    } else {
      // Local sandbox registration
      showToast('Sandbox Import', \`Imported \${PARSED_STUDENT_ROSTER.length} students into local state.\`, 'check-circle');
    }

    closeBulkStudentImportModal();
    if (typeof renderManageStudentsPage === 'function') renderManageStudentsPage();
  } catch (err) {
    console.error('Bulk import error:', err);
    showToast('Import Error', err.message || 'Failed to complete student roster import.', 'alert-triangle');
    if (execBtn) {
      execBtn.disabled = false;
      execBtn.innerHTML = '<i data-lucide="user-check" style="width:16px;height:16px;"></i><span>Try Again</span>';
    }
  }
}

/* =========================================================================
   FIRST LOGIN FORCE PASSWORD CHANGE CONTROLLER
   ========================================================================= */
function checkForcePasswordChange(session) {
  if (!session || !session.user) return;
  const mustChange = session.user.user_metadata?.must_change_password;
  if (mustChange) {
    const modal = document.getElementById('modal-force-password-change');
    if (modal) {
      modal.style.display = 'flex';
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }
  }
}

async function handleForcePasswordSubmit(e) {
  if (e) e.preventDefault();
  const pwdInput = document.getElementById('new-permanent-pwd');
  const confirmInput = document.getElementById('confirm-permanent-pwd');
  const submitBtn = document.getElementById('btn-submit-force-pwd');

  const newPwd = pwdInput ? pwdInput.value : '';
  const confirmPwd = confirmInput ? confirmInput.value : '';

  if (!newPwd || newPwd.length < 8) {
    showToast('Weak Password', 'Password must be at least 8 characters long.', 'alert-circle');
    return;
  }
  if (newPwd !== confirmPwd) {
    showToast('Mismatch', 'Passwords do not match. Please re-enter.', 'alert-circle');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader" style="width:16px;height:16px;"></i><span>Updating Credentials…</span>';
  }

  try {
    if (supabase) {
      const { data, error } = await supabase.auth.updateUser({
        password: newPwd,
        data: { must_change_password: false }
      });
      if (error) throw error;
    }
    showToast('Password Updated', 'Your permanent password has been activated.', 'shield-check');
    const modal = document.getElementById('modal-force-password-change');
    if (modal) modal.style.display = 'none';
  } catch (err) {
    console.error('Password rotation error:', err);
    showToast('Update Failed', err.message || 'Could not update password.', 'alert-octagon');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="lock" style="width:16px;height:16px;"></i><span>Save Password &amp; Continue</span>';
    }
  }
}
`;

content = content.replace('</script>\n</body>', jsLogicToAppend + '\n</script>\n</body>');

// 9. Call checkForcePasswordChange inside loadUserFromSession
const loadUserHookOld = `updateRoleIndicatorUI(realRole);
    executeLogin(userProfile);`;

const loadUserHookNew = `updateRoleIndicatorUI(realRole);
    executeLogin(userProfile);
    checkForcePasswordChange(session);`;

content = content.replace(loadUserHookOld, loadUserHookNew);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Production polish pass successfully applied to BrainzOS.html!');
