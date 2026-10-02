const fs = require('fs');

// 1. Update config.js
const configContent = `/**
 * BrainzOS — Institutional Environment & Local Supabase Configuration
 * =========================================================================
 * Single-origin self-hosted configuration.
 * All traffic stays on the local school host (window.location.origin).
 * Zero cloud dependencies or external third-party telemetry.
 * =========================================================================
 */
window.BRAINZOS_CONFIG = {
  SUPABASE_URL: (typeof window !== 'undefined' && window.BRAINZOS_SUPABASE_URL)
    || (typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : 'http://127.0.0.1:8080'),
  SUPABASE_ANON_KEY: (typeof window !== 'undefined' && window.BRAINZOS_SUPABASE_ANON_KEY)
    || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQ1ODU2MDAsImV4cCI6MjAyMDcyOTYwMH0.local-anon-token-placeholder"
};
`;
fs.writeFileSync('config.js', configContent, 'utf8');
console.log('Updated config.js to use window.location.origin');

// 2. Update BrainzOS.html exportGradebookCSV and exportAuditLogsCSV
let html = fs.readFileSync('BrainzOS.html', 'utf8').replace(/\r\n/g, '\n');

// Update exportGradebookCSV: remove early return when empty so empty CSV header downloads
html = html.replace(
  /function exportGradebookCSV\(\) \{\s*if \(!GRADEBOOK_DATA \|\| GRADEBOOK_DATA\.length === 0\) \{\s*showToast\('No Gradebook Data', 'No continuous assessment records available to export\.', 'info'\);\s*return;\s*\}\s*const classSection = STATE\.currentUser\?\.class_section \|\| 'XI-B';\s*const headers = \['Student ID', 'Student Name', 'Quiz \(20\)', 'Case Study \(40\)', 'Presentation \(40\)', 'Total \(100\)'\];\s*const rows = GRADEBOOK_DATA\.map/m,
  `function exportGradebookCSV() {
  const classSection = STATE.currentUser?.class_section || 'XI-B';
  const headers = ['Student ID', 'Student Name', 'Quiz (20)', 'Case Study (40)', 'Presentation (40)', 'Total (100)'];
  const rows = (GRADEBOOK_DATA || []).map`
);

// Update exportAuditLogsCSV: remove early return when empty so empty CSV header downloads
html = html.replace(
  /function exportAuditLogsCSV\(\) \{\s*if \(!AUDIT_LOGS \|\| AUDIT_LOGS\.length === 0\) \{\s*showToast\('No Audit Logs', 'No activity records available to export\.', 'info'\);\s*return;\s*\}\s*const headers = \['Timestamp', 'Actor', 'Action Description', 'Device'\];\s*const rows = AUDIT_LOGS\.map/m,
  `function exportAuditLogsCSV() {
  const headers = ['Timestamp', 'Actor', 'Action Description', 'Device'];
  const rows = (AUDIT_LOGS || []).map`
);

fs.writeFileSync('BrainzOS.html', html, 'utf8');
console.log('Updated export functions in BrainzOS.html');
