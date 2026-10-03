const fs = require('fs');

let html = fs.readFileSync('BrainzOS.html', 'utf8').replace(/\r\n/g, '\n');

// 1. Add id="new-assign-submit-btn" to the modal submit button
const oldBtn = `<button class="btn-primary" type="submit" aria-label="Confirm and publish assignment">
<i data-lucide="check" aria-hidden="true" style="width: 15px; height: 15px;"></i>
<span>Add Assignment</span>
</button>`;

const newBtn = `<button class="btn-primary" id="new-assign-submit-btn" type="submit" aria-label="Confirm and publish assignment">
<i data-lucide="check" aria-hidden="true" style="width: 15px; height: 15px;"></i>
<span>Add Assignment</span>
</button>`;

console.log('Replacing submit button id:', html.includes(oldBtn));
html = html.replace(oldBtn, newBtn);

// 2. Fix handleCreateAssignment
const oldFunc = `function handleCreateAssignment(e) {
  if (e) e.preventDefault();
  clearAssignmentErrors();

  const titleEl = document.getElementById('new-assign-title');
  const cohortEl = document.getElementById('new-assign-class');
  const subjectEl = document.getElementById('new-assign-subject');
  const dueEl = document.getElementById('new-assign-due');

  const title = titleEl ? titleEl.value.trim() : '';
  const cohort = cohortEl ? cohortEl.value : 'XI-B Commerce';
  const subject = subjectEl ? subjectEl.value : 'Political Science';
  const due = dueEl ? dueEl.value.trim() : '';

  const assigneeTypeEl = document.querySelector('input[name="new-assignee-type"]:checked');
  const assigneeType = assigneeTypeEl ? assigneeTypeEl.value : 'class';
  const checkedStudentIds = Array.from(document.querySelectorAll('.assignee-student-chk:checked')).map(c => c.value);

  let hasError = false;
  if (!title || title.length < 4) {
    if (titleEl) titleEl.classList.add('has-error');
    const err = document.getElementById('new-assign-title-error');
    if (err) err.style.display = 'flex';
    hasError = true;
  }
  if (!due) {
    if (dueEl) dueEl.classList.add('has-error');
    const err = document.getElementById('new-assign-due-error');
    if (err) err.style.display = 'flex';
    hasError = true;
  }
  if (assigneeType === 'individual' && checkedStudentIds.length === 0) {
    const err = document.getElementById('new-assign-students-error');
    if (err) err.style.display = 'flex';
    hasError = true;
  }
  if (hasError) return;
  if (formSubmitBtn) { formSubmitBtn.disabled = true; formSubmitBtn.textContent = 'Publishing…'; }

  const classSection = cohort.includes('XI-B') ? 'XI-B' : 'XI-A';
  let dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 4);

  if (supabase && STATE.currentUser) {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .insert({
          title: title,
          subject: subject,
          class_section: classSection,
          due_date: dueDate.toISOString(),
          weightage: 20,
          created_by: STATE.currentUser.id,
          assignee_type: assigneeType
        })
        .select()
        .single();

      if (error) throw error;

      if (assigneeType === 'individual' && data && checkedStudentIds.length > 0) {
        const individualRows = checkedStudentIds.map(sId => ({
          assignment_id: data.id,
          student_id: sId
        }));
        await supabase
          .from('assignment_individual_assignees')
          .insert(individualRows);
      }

      await logAuditEvent(\`Published coursework: "\${title}" for \${cohort} (\${assigneeType === 'individual' ? \`\${checkedStudentIds.length} students\` : 'Whole Class'})\`);
    } catch (err) {
      console.error('Failed to create assignment in database:', err);
      showToast('Publish Error', err.message, 'alert-circle');
    }
  }

  const newAssignment = {
    id: 'assign-' + Date.now(),
    title: escapeHtml(title),
    cohort: escapeHtml(cohort),
    subject: escapeHtml(subject),
    due: escapeHtml(due),
    progress: 0,
    submissions: assigneeType === 'individual' ? \`0/\${checkedStudentIds.length} submitted\` : '0/36 submitted',
    badge: assigneeType === 'individual' ? \`Individual (\${checkedStudentIds.length})\` : 'Whole Class'
  };

  TEACHER_ASSIGNMENTS_DATA.unshift(newAssignment);
  renderAssignmentsList();

  const formEl = document.getElementById('new-assignment-form');
  if (formEl) formEl.reset();
  closeNewAssignmentModal();

  const banner = document.getElementById('assignment-success-banner');
  const bannerText = document.getElementById('assignment-success-text');
  if (banner) {
    if (bannerText) bannerText.textContent = \`Assignment "\${title}" published for \${cohort}.\`;
    banner.style.display = 'flex';
    setTimeout(() => { if (banner) banner.style.display = 'none'; }, 5000);
  }

  showToast('Assignment Created', \`Successfully scheduled "\${title}".\`, 'check');
}`;

const newFunc = `async function handleCreateAssignment(e) {
  if (e) e.preventDefault();
  clearAssignmentErrors();

  const titleEl = document.getElementById('new-assign-title');
  const cohortEl = document.getElementById('new-assign-class');
  const subjectEl = document.getElementById('new-assign-subject');
  const dueEl = document.getElementById('new-assign-due');
  const formSubmitBtn = document.getElementById('new-assign-submit-btn') || document.querySelector('#new-assignment-form button[type="submit"]');

  const title = titleEl ? titleEl.value.trim() : '';
  const cohort = cohortEl ? cohortEl.value : 'XI-B Commerce';
  const subject = subjectEl ? subjectEl.value : 'Political Science';
  const due = dueEl ? dueEl.value.trim() : '';

  const assigneeTypeEl = document.querySelector('input[name="new-assignee-type"]:checked');
  const assigneeType = assigneeTypeEl ? assigneeTypeEl.value : 'class';
  const checkedStudentIds = Array.from(document.querySelectorAll('.assignee-student-chk:checked')).map(c => c.value);

  let hasError = false;
  if (!title || title.length < 4) {
    if (titleEl) titleEl.classList.add('has-error');
    const err = document.getElementById('new-assign-title-error');
    if (err) err.style.display = 'flex';
    hasError = true;
  }
  if (!due) {
    if (dueEl) dueEl.classList.add('has-error');
    const err = document.getElementById('new-assign-due-error');
    if (err) err.style.display = 'flex';
    hasError = true;
  }
  if (assigneeType === 'individual' && checkedStudentIds.length === 0) {
    const err = document.getElementById('new-assign-students-error');
    if (err) err.style.display = 'flex';
    hasError = true;
  }
  if (hasError) return;

  if (formSubmitBtn) {
    formSubmitBtn.disabled = true;
    formSubmitBtn.textContent = 'Publishing…';
  }

  const classSection = cohort.includes('XI-B') ? 'XI-B' : 'XI-A';
  let dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 4);

  if (supabase && STATE.currentUser) {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .insert({
          title: title,
          subject: subject,
          class_section: classSection,
          due_date: dueDate.toISOString(),
          weightage: 20,
          created_by: STATE.currentUser.id,
          assignee_type: assigneeType
        })
        .select()
        .single();

      if (error) throw error;

      if (assigneeType === 'individual' && data && checkedStudentIds.length > 0) {
        const individualRows = checkedStudentIds.map(sId => ({
          assignment_id: data.id,
          student_id: sId
        }));
        await supabase
          .from('assignment_individual_assignees')
          .insert(individualRows);
      }

      await logAuditEvent(\`Published coursework: "\${title}" for \${cohort} (\${assigneeType === 'individual' ? \`\${checkedStudentIds.length} students\` : 'Whole Class'})\`);
    } catch (err) {
      console.warn('Database write fallback to local session:', err.message || err);
    }
  }

  const newAssignment = {
    id: 'assign-' + Date.now(),
    title: escapeHtml(title),
    cohort: escapeHtml(cohort),
    subject: escapeHtml(subject),
    due: escapeHtml(due),
    progress: 0,
    submissions: assigneeType === 'individual' ? \`0/\${checkedStudentIds.length} submitted\` : '0/36 submitted',
    badge: assigneeType === 'individual' ? \`Individual (\${checkedStudentIds.length})\` : 'Whole Class'
  };

  TEACHER_ASSIGNMENTS_DATA.unshift(newAssignment);
  renderAssignmentsList();

  const formEl = document.getElementById('new-assignment-form');
  if (formEl) formEl.reset();
  closeNewAssignmentModal();

  if (formSubmitBtn) {
    formSubmitBtn.disabled = false;
    formSubmitBtn.innerHTML = '<i data-lucide="check" aria-hidden="true" style="width: 15px; height: 15px;"></i><span>Add Assignment</span>';
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }

  const banner = document.getElementById('assignment-success-banner');
  const bannerText = document.getElementById('assignment-success-text');
  if (banner) {
    if (bannerText) bannerText.textContent = \`Assignment "\${title}" published for \${cohort}.\`;
    banner.style.display = 'flex';
    setTimeout(() => { if (banner) banner.style.display = 'none'; }, 5000);
  }

  showToast('Assignment Created', \`Successfully scheduled "\${title}".\`, 'check');
}`;

console.log('Replacing handleCreateAssignment:', html.includes(oldFunc));
html = html.replace(oldFunc, newFunc);

fs.writeFileSync('BrainzOS.html', html, 'utf8');
console.log('Successfully patched handleCreateAssignment in BrainzOS.html');
