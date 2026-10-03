const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'BrainzOS.html');
let html = fs.readFileSync(file, 'utf8');

const target = `<section class="os-page" id="page-director-teachers">
  <div class="page-header">
    <div>
      <div style="display: flex; gap: 8px; margin-bottom: 6px;">
        <span class="badge badge-blue">Directorate Control</span>
        <span class="badge badge-sage">Identity &amp; Access</span>
      </div>
      <h1 class="page-header-title">Faculty Roster &amp; Account Provisioning</h1>
      <p class="page-header-desc">Securely provision verified teacher accounts with server-side credentials and cohort assignments.</p>
    </div>
  </div>`;

const replacement = `<section class="os-page" id="page-director-teachers">
  <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px;">
    <div>
      <div style="display: flex; gap: 8px; margin-bottom: 6px;">
        <span class="badge badge-blue">Directorate Control</span>
        <span class="badge badge-sage">Identity &amp; Access</span>
      </div>
      <h1 class="page-header-title">Faculty Roster &amp; Account Provisioning</h1>
      <p class="page-header-desc">Securely provision verified teacher accounts with server-side credentials and cohort assignments.</p>
    </div>
    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
      <button class="btn-secondary" onclick="openBulkStudentImportModal()" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px;">
        <i data-lucide="file-spreadsheet" style="width: 16px; height: 16px;"></i>
        <span>Bulk Import Students (CSV)</span>
      </button>
    </div>
  </div>`;

// Normalize CRLF to LF for matching
const normalizedHtml = html.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (normalizedHtml.includes(normalizedTarget)) {
  const updated = normalizedHtml.replace(normalizedTarget, replacement.replace(/\r\n/g, '\n'));
  fs.writeFileSync(file, updated, 'utf8');
  console.log('Successfully patched page-director-teachers header with Bulk Import Students button!');
} else {
  console.log('Target not matched');
}
