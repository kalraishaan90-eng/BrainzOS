const fs = require('fs');

let content = fs.readFileSync('BrainzOS.html', 'utf8');

// 1. handleCreateAssignment double submit disable
content = content.replace(
  `async function handleCreateAssignment(e) {
  if (e) e.preventDefault();
  clearAssignmentErrors();`,
  `async function handleCreateAssignment(e) {
  if (e) e.preventDefault();
  clearAssignmentErrors();
  const formSubmitBtn = document.querySelector('#new-assignment-form button[type="submit"]');`
);

content = content.replace(
  `  if (hasError) return;`,
  `  if (hasError) return;
  if (formSubmitBtn) { formSubmitBtn.disabled = true; formSubmitBtn.textContent = 'Publishing…'; }`
);

content = content.replace(
  `  const formEl = document.getElementById('new-assignment-form');
  if (formEl) formEl.reset();
  closeNewAssignmentModal();`,
  `  if (formSubmitBtn) { formSubmitBtn.disabled = false; formSubmitBtn.textContent = 'Add Assignment'; }
  const formEl = document.getElementById('new-assignment-form');
  if (formEl) formEl.reset();
  closeNewAssignmentModal();`
);

// 2. handlePublishBroadcast double submit disable
content = content.replace(
  `async function handlePublishBroadcast(e) {
  if (e) e.preventDefault();
  clearBroadcastErrors();`,
  `async function handlePublishBroadcast(e) {
  if (e) e.preventDefault();
  clearBroadcastErrors();
  const publishBtn = document.getElementById('publish-broadcast-btn');`
);

content = content.replace(
  `  if (hasError) return;

  if (supabase && STATE.currentUser) {`,
  `  if (hasError) return;
  if (publishBtn) { publishBtn.disabled = true; publishBtn.innerHTML = '<i data-lucide="loader" style="width:16px;height:16px;"></i><span>Publishing…</span>'; }

  if (supabase && STATE.currentUser) {`
);

content = content.replace(
  `  if (!BROADCASTS_DATA.some(bc => bc.headline === newBroadcast.headline && bc.message === newBroadcast.message)) {
    BROADCASTS_DATA.unshift(newBroadcast);
  }
  renderBroadcastsList();
  resetBroadcastForm();`,
  `  if (!BROADCASTS_DATA.some(bc => bc.headline === newBroadcast.headline && bc.message === newBroadcast.message)) {
    BROADCASTS_DATA.unshift(newBroadcast);
  }
  renderBroadcastsList();
  resetBroadcastForm();
  if (publishBtn) { publishBtn.disabled = false; publishBtn.innerHTML = '<i data-lucide="send" style="width:16px;height:16px;"></i><span>Publish Broadcast</span>'; if (window.lucide?.createIcons) window.lucide.createIcons(); }`
);

// 3. submitNewNotice double submit disable
content = content.replace(
  `async function submitNewNotice() {
  const categoryEl = document.getElementById('notice-category');`,
  `async function submitNewNotice() {
  const modalEl = document.getElementById('notice-modal-overlay');
  const submitBtn = modalEl ? modalEl.querySelector('button.btn-primary') : null;
  const categoryEl = document.getElementById('notice-category');`
);

content = content.replace(
  `  closeNewNoticeModal();

  if (supabase && STATE.currentUser) {`,
  `  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Publishing…'; }
  closeNewNoticeModal();

  if (supabase && STATE.currentUser) {`
);

content = content.replace(
  `  showToast('School Notice Dispatched', 'Broadcast transmitted to campus feed.', 'send');
}`,
  `  showToast('School Notice Dispatched', 'Broadcast transmitted to campus feed.', 'send');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Publish to Feed'; }
}`
);

// 4. handleApplyLeave double submit disable
content = content.replace(
  `async function handleApplyLeave(e) {
  if (e) e.preventDefault();
  const leaveDate = document.getElementById('leave-date-input')?.value;`,
  `async function handleApplyLeave(e) {
  if (e) e.preventDefault();
  const formEl = document.getElementById('form-teacher-leave');
  const submitBtn = formEl ? formEl.querySelector('button[type="submit"]') : null;
  const leaveDate = document.getElementById('leave-date-input')?.value;`
);

content = content.replace(
  `  const teacherName = STATE.currentUser?.name || 'Aarav Mehta';
  const teacherId = STATE.currentUser?.id || 'a0000000-0000-0000-0000-000000000002';
  const classSection = STATE.currentUser?.class_section || 'XI-B';

  if (supabase && STATE.currentUser) {`,
  `  const teacherName = STATE.currentUser?.name || 'Aarav Mehta';
  const teacherId = STATE.currentUser?.id || 'a0000000-0000-0000-0000-000000000002';
  const classSection = STATE.currentUser?.class_section || 'XI-B';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="status-dot"></span><span>Submitting…</span>'; }

  if (supabase && STATE.currentUser) {`
);

content = content.replace(
  `  fetchTeacherLeaveHistory();
  showToast('Leave Request Submitted', 'Application sent to Directorate for review.', 'check');
}`,
  `  fetchTeacherLeaveHistory();
  if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i data-lucide="send" style="width:16px;height:16px;"></i><span>Submit Application</span>'; if (window.lucide?.createIcons) window.lucide.createIcons(); }
  showToast('Leave Request Submitted', 'Application sent to Directorate for review.', 'check');
}`
);

fs.writeFileSync('BrainzOS.html', content, 'utf8');
console.log('Double submit prevention applied successfully');
