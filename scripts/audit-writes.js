const fs = require('fs');

const content = fs.readFileSync('BrainzOS.html', 'utf8');

const writeFunctions = [
  'handleCreateAssignment',
  'handlePublishBroadcast',
  'saveAttendanceSnapshot',
  'handleCreateTeacher',
  'handleApplyLeave',
  'handleApproveLeave',
  'handleRejectLeave',
  'handleAssignSubstitute',
  'handleCreateLecturePlan',
  'handleCreateTestSchedule',
  'saveManageStudentRow',
  'handleSaveStudentProfile',
  'savePromotionSettings',
  'saveClassProgressionMap',
  'executeFinalizePromotion',
  'submitOverride',
  'createAcademicYear',
  'saveFinalMarks',
  'submitNewNotice',
  'handleDirectorDocumentUpload'
];

writeFunctions.forEach(fn => {
  const idx = content.indexOf('function ' + fn) !== -1 ? content.indexOf('function ' + fn) : content.indexOf('async function ' + fn);
  if (idx === -1) {
    console.log(`[MISSING] ${fn}`);
    return;
  }
  const snippet = content.slice(idx, idx + 1200);
  const disablesBtn = /disabled\s*=\s*true/i.test(snippet);
  const hasAuditLog = /logAuditEvent|audit_logs/i.test(snippet);
  const hasToast = /showToast/i.test(snippet);
  console.log(`[${fn}] disablesBtn=${disablesBtn} | hasAuditLog=${hasAuditLog} | hasToast=${hasToast}`);
});
