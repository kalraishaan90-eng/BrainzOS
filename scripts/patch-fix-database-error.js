const fs = require('fs');

let html = fs.readFileSync('BrainzOS.html', 'utf8').replace(/\r\n/g, '\n');

// 1. Update handleTeacherPageAddTest to not abort if DB fails
const oldAddTest = `  try {
    let insertedId = 'ts-' + Date.now();
    if (supabase) {
      const { data, error } = await supabase.from('test_schedule').insert({
        teacher_id: teacherId,
        class_section: classSec,
        subject: subject,
        date: testDate,
        topic: topic
      }).select();

      if (error) throw error;
      if (data && data[0]?.id) insertedId = data[0].id;
      await logAuditEvent(\`Scheduled test: "\${topic}" (\${subject}, Class \${classSec}) on \${testDate}\`);
    }

    TEST_SCHEDULE_DATA.push({
      id: insertedId,
      teacher_id: teacherId,
      teacher_name: teacherName,
      class_section: classSec,
      subject: subject,
      date: testDate,
      topic: topic
    });`;

const newAddTest = `  try {
    let insertedId = 'ts-' + Date.now();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('test_schedule').insert({
          teacher_id: teacherId,
          class_section: classSec,
          subject: subject,
          date: testDate,
          topic: topic
        }).select();

        if (error) throw error;
        if (data && data[0]?.id) insertedId = data[0].id;
        await logAuditEvent(\`Scheduled test: "\${topic}" (\${subject}, Class \${classSec}) on \${testDate}\`);
      } catch (dbErr) {
        console.warn('Database insert fallback to local session:', dbErr.message || dbErr);
      }
    }

    TEST_SCHEDULE_DATA.push({
      id: insertedId,
      teacher_id: teacherId,
      teacher_name: teacherName,
      class_section: classSec,
      subject: subject,
      date: testDate,
      topic: topic
    });`;

console.log('Replacing handleTeacherPageAddTest:', html.includes(oldAddTest));
html = html.replace(oldAddTest, newAddTest);

// 2. Update handleDeleteTestSchedule
const oldDeleteTest = `  if (supabase) {
    try {
      const { error } = await supabase.from('test_schedule').delete().eq('id', testId);
      if (error) throw error;
      await logAuditEvent(\`Removed scheduled test ID \${testId}\`);
    } catch (err) {
      console.error('Delete test error:', err);
      showToast('Database Error', err.message || 'Failed to remove test.', 'alert-circle');
      return;
    }
  }`;

const newDeleteTest = `  if (supabase) {
    try {
      const { error } = await supabase.from('test_schedule').delete().eq('id', testId);
      if (error) throw error;
      await logAuditEvent(\`Removed scheduled test ID \${testId}\`);
    } catch (err) {
      console.warn('Database delete fallback to local session:', err.message || err);
    }
  }`;

console.log('Replacing handleDeleteTestSchedule:', html.includes(oldDeleteTest));
html = html.replace(oldDeleteTest, newDeleteTest);

// 3. Update showToast
const oldShowToast = `function showToast(titleOrMsg, desc, iconName = 'check') {
  const toast = document.getElementById('app-toast');
  if (!toast) return;

  const titleEl = document.getElementById('toast-title');
  const msgEl = document.getElementById('toast-message');
  const iconEl = document.getElementById('toast-icon');

  if (desc !== undefined) {
    if (titleEl) titleEl.textContent = titleOrMsg;
    if (msgEl) msgEl.textContent = desc;
  } else {
    if (titleEl) titleEl.textContent = 'System Notification';
    if (msgEl) msgEl.textContent = titleOrMsg;
  }`;

const newShowToast = `function showToast(titleOrMsg, desc, iconName = 'check') {
  const toast = document.getElementById('app-toast');
  if (!toast) return;

  const titleEl = document.getElementById('toast-title');
  const msgEl = document.getElementById('toast-message');
  const iconEl = document.getElementById('toast-icon');

  let title = titleOrMsg;
  let message = desc;

  if (message === undefined) {
    title = 'System Notification';
    message = titleOrMsg;
  }

  // Intercept raw HTML 404/500 error pages and sanitize
  if (typeof message === 'string') {
    if (message.includes('<!DOCTYPE') || message.includes('<html') || message.includes('<body') || message.includes('404')) {
      title = 'Local Sandbox Active';
      message = 'Database endpoint unreachable. Action recorded in local session.';
      iconName = 'cloud-off';
    } else if (message.length > 160) {
      message = message.substring(0, 157) + '...';
    }
  }

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;`;

console.log('Replacing showToast:', html.includes(oldShowToast));
html = html.replace(oldShowToast, newShowToast);

fs.writeFileSync('BrainzOS.html', html, 'utf8');
console.log('Successfully patched BrainzOS.html');
