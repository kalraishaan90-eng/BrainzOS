const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'BrainzOS.html');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Current size:', content.length);

// 1. In fetchBroadcasts: make sure finally calls renderStudentFeed too
const oldFetchBcFinally = `  } finally {
    renderBroadcastsList();
    if (typeof renderFeed === 'function') renderFeed();
  }`;

const newFetchBcFinally = `  } finally {
    renderBroadcastsList();
    if (typeof renderFeed === 'function') renderFeed();
    if (typeof renderStudentFeed === 'function') renderStudentFeed();
  }`;

if (content.includes(oldFetchBcFinally)) {
  content = content.replace(oldFetchBcFinally, newFetchBcFinally);
  console.log('✓ Patched fetchBroadcasts finally');
}

// 2. Updated renderBroadcastsList and new renderStudentFeed
const oldRenderBcList = `function renderBroadcastsList() {
  const container = document.getElementById('announcements-feed-container');
  if (!container) return;
  container.innerHTML = '';

  BROADCASTS_DATA.forEach(bc => {
    const item = document.createElement('div');
    item.className = 'announcement-item';
    item.id = \`bc-item-\${bc.id}\`;

    item.innerHTML = \`
      <div class="announcement-header">
        <h4 class="announcement-headline">\${escapeHtml(bc.headline)}</h4>
        <span class="badge badge-beige">\${escapeHtml(bc.audience)}</span>
      </div>
      <div class="announcement-meta">
        <span><i data-lucide="user" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle;"></i> \${escapeHtml(bc.author)}</span>
        <span>·</span>
        <span><i data-lucide="clock" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle;"></i> \${escapeHtml(bc.time)}</span>
        <span>·</span>
        <span class="badge badge-sage" style="padding: 1px 6px; font-size: 10px;">\${escapeHtml(bc.category)}</span>
      </div>
      <p class="announcement-body">\${escapeHtml(bc.message)}</p>
    \`;
    container.appendChild(item);
  });

  const countBadge = document.getElementById('broadcasts-count-badge');
  if (countBadge) countBadge.textContent = \`\${BROADCASTS_DATA.length} Published\`;
  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}`;

const newRenderBcList = `function renderBroadcastsList() {
  const container = document.getElementById('announcements-feed-container');
  if (!container) return;
  container.innerHTML = '';

  const broadcasts = Array.isArray(BROADCASTS_DATA) ? BROADCASTS_DATA : [];
  // Teachers should see Whole School, Teachers Only, or subject announcements — NOT 'Students Only'
  const teacherBroadcasts = broadcasts.filter(bc => {
    const aud = (bc.audience || '').trim().toLowerCase();
    return aud !== 'students only';
  });

  if (teacherBroadcasts.length === 0) {
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--color-ink-subtle); font-size: var(--text-sm); font-style: italic;">No faculty notices currently dispatched.</div>';
  } else {
    teacherBroadcasts.forEach(bc => {
      const item = document.createElement('div');
      item.className = 'announcement-item';
      item.id = \`bc-item-\${bc.id}\`;

      const isTeachersOnly = (bc.audience || '').toLowerCase() === 'teachers only';
      const badgeClass = isTeachersOnly ? 'badge-sage' : 'badge-beige';

      item.innerHTML = \`
        <div class="announcement-header">
          <h4 class="announcement-headline">\${escapeHtml(bc.headline)}</h4>
          <span class="badge \${badgeClass}">\${escapeHtml(bc.audience)}</span>
        </div>
        <div class="announcement-meta">
          <span><i data-lucide="user" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle;"></i> \${escapeHtml(bc.author || 'Administration')}</span>
          <span>·</span>
          <span><i data-lucide="clock" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle;"></i> \${escapeHtml(bc.time || 'Recent')}</span>
          <span>·</span>
          <span class="badge badge-blue" style="padding: 1px 6px; font-size: 10px;">\${escapeHtml(bc.category || 'Notice')}</span>
        </div>
        <p class="announcement-body">\${escapeHtml(bc.message)}</p>
      \`;
      container.appendChild(item);
    });
  }

  const countBadge = document.getElementById('broadcasts-count-badge');
  if (countBadge) countBadge.textContent = \`\${teacherBroadcasts.length} Published\`;

  const overviewCount = document.getElementById('overview-stat-broadcasts');
  if (overviewCount) overviewCount.textContent = String(teacherBroadcasts.length).padStart(2, '0');

  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

function renderStudentFeed() {
  const container = document.getElementById('student-feed-container');
  if (!container) return;

  const broadcasts = Array.isArray(BROADCASTS_DATA) ? BROADCASTS_DATA : [];
  // Students see announcements where audience is Whole School, Students Only, or cohort classes — NOT 'Teachers Only' or 'Staff Only'
  const studentBroadcasts = broadcasts.filter(bc => {
    const aud = (bc.audience || '').trim().toLowerCase();
    return aud !== 'teachers only' && aud !== 'staff only';
  });

  if (studentBroadcasts.length === 0) {
    container.innerHTML = \`
      <div class="feed-item">
        <div class="feed-top">
          <span class="badge badge-blue" style="font-size: 0.65rem;">Commerce Club</span>
          <span class="feed-time">Today · 08:45 AM</span>
        </div>
        <div class="feed-title">Mock-Trading Challenge Registrations</div>
        <div class="feed-desc">Intra-school mock equity trading portal opens at 2:00 PM today. Virtual portfolios are now seeded with ₹1,00,000 demo capital.</div>
      </div>
      <div class="feed-item">
        <div class="feed-top">
          <span class="badge badge-beige" style="font-size: 0.65rem;">Student Council</span>
          <span class="feed-time">Yesterday · 4:15 PM</span>
        </div>
        <div class="feed-title">House Cup Standings Revised</div>
        <div class="feed-desc">Nalanda House earns +120 points following the Inter-House Business Quiz win, cutting Takshashila's lead to 140 points.</div>
      </div>
    \`;
    return;
  }

  container.innerHTML = studentBroadcasts.map(bc => {
    const isStudentsOnly = (bc.audience || '').toLowerCase() === 'students only';
    const badgeClass = isStudentsOnly ? 'badge-blue' : 'badge-beige';
    return \`
      <div class="feed-item">
        <div class="feed-top">
          <span class="badge \${badgeClass}" style="font-size: 0.65rem;">\${escapeHtml(bc.audience || 'Whole School')}</span>
          <span class="feed-time">\${escapeHtml(bc.time || 'Recent')}</span>
        </div>
        <div class="feed-title">\${escapeHtml(bc.headline)}</div>
        <div class="feed-desc">\${escapeHtml(bc.message)}</div>
      </div>
    \`;
  }).join('');

  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}`;

if (content.includes(oldRenderBcList)) {
  content = content.replace(oldRenderBcList, newRenderBcList);
  console.log('✓ Patched renderBroadcastsList & added renderStudentFeed');
}

// 3. Updated renderFeed to show audience badges clearly in director feed
const oldFeedCard = `    card.innerHTML = \`
      <div class="feed-cat-icon \${meta.catClass}">
        <i data-lucide="\${meta.icon}" style="width: 20px; height: 20px;"></i>
      </div>
      <div class="feed-content">
        <div class="feed-header-meta">
          <span class="badge \${meta.badgeClass}">\${escapeHtml(bc.audience || meta.category)}</span>
          <span style="font-size: var(--text-xs); font-weight: 500; color: var(--color-ink-muted);"><i data-lucide="user" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 3px;"></i>\${escapeHtml(bc.author || 'Administration')}</span>
          <span style="font-size: var(--text-xs); color: var(--color-ink-subtle);">·</span>
          <span style="font-size: var(--text-xs); color: var(--color-ink-subtle); font-family: monospace;"><i data-lucide="clock" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 3px;"></i>\${escapeHtml(bc.time || 'Recent')}</span>
        </div>
        <div class="feed-title">\${escapeHtml(bc.headline)}</div>
        <p class="feed-subtext" style="margin: 0; line-height: 1.55;">\${escapeHtml(bc.message)}</p>
      </div>
    \`;`;

const newFeedCard = `    let audBadge = \`<span class="badge \${meta.badgeClass}">\${escapeHtml(bc.audience || meta.category)}</span>\`;
    if (bc.audience === 'Students Only') {
      audBadge = \`<span class="badge badge-blue"><i data-lucide="users" style="width:11px;height:11px;margin-right:3px;"></i>Students Only</span>\`;
    } else if (bc.audience === 'Teachers Only') {
      audBadge = \`<span class="badge badge-sage"><i data-lucide="user-check" style="width:11px;height:11px;margin-right:3px;"></i>Teachers Only</span>\`;
    } else if (bc.audience === 'Whole School') {
      audBadge = \`<span class="badge badge-beige"><i data-lucide="globe" style="width:11px;height:11px;margin-right:3px;"></i>Whole School</span>\`;
    }

    card.innerHTML = \`
      <div class="feed-cat-icon \${meta.catClass}">
        <i data-lucide="\${meta.icon}" style="width: 20px; height: 20px;"></i>
      </div>
      <div class="feed-content">
        <div class="feed-header-meta">
          \${audBadge}
          <span style="font-size: var(--text-xs); font-weight: 500; color: var(--color-ink-muted);"><i data-lucide="user" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 3px;"></i>\${escapeHtml(bc.author || 'Administration')}</span>
          <span style="font-size: var(--text-xs); color: var(--color-ink-subtle);">·</span>
          <span style="font-size: var(--text-xs); color: var(--color-ink-subtle); font-family: monospace;"><i data-lucide="clock" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 3px;"></i>\${escapeHtml(bc.time || 'Recent')}</span>
        </div>
        <div class="feed-title">\${escapeHtml(bc.headline)}</div>
        <p class="feed-subtext" style="margin: 0; line-height: 1.55;">\${escapeHtml(bc.message)}</p>
      </div>
    \`;`;

if (content.includes(oldFeedCard)) {
  content = content.replace(oldFeedCard, newFeedCard);
  console.log('✓ Patched renderFeed audience badges');
}

// 4. Update submitNewNotice
const oldSubmitNotice = `async function submitNewNotice() {
  const categoryEl = document.getElementById('notice-category');
  const headlineEl = document.getElementById('notice-headline');
  const bodyEl = document.getElementById('notice-body');

  const category = categoryEl ? categoryEl.value : 'Operations';
  const headline = headlineEl ? headlineEl.value.trim() : '';
  const message = bodyEl ? bodyEl.value.trim() : '';

  if (!headline || headline.length < 4) {
    showToast('Validation Error', 'Announcement headline must be at least 4 characters long.', 'alert-triangle');
    if (headlineEl) headlineEl.focus();
    return;
  }
  if (!message || message.length < 8) {
    showToast('Validation Error', 'Announcement message must be at least 8 characters long.', 'alert-triangle');
    if (bodyEl) bodyEl.focus();
    return;
  }

  closeNewNoticeModal();

  if (supabase && STATE.currentUser) {
    try {
      const { data, error } = await supabase
        .from('broadcasts')
        .insert({
          headline: headline,
          message: message,
          audience: category,
          published_by: STATE.currentUser.id
        })
        .select()
        .single();

      if (error) throw error;
      await logAuditEvent(\`Published school-wide notice: "\${headline}" to \${category}\`);
    } catch (err) {
      console.error('Failed to insert broadcast row:', err);
      showToast('Publish Error', err.message, 'alert-circle');
    }
  } else {
    await logAuditEvent(\`Published school-wide notice: "\${headline}" to \${category}\`);
  }

  const newBroadcast = {
    id: 'bc-' + Date.now(),
    headline: escapeHtml(headline),
    audience: escapeHtml(category),
    author: STATE.currentUser ? escapeHtml(STATE.currentUser.name) : 'School Director',
    time: \`Today at \${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\`,
    category: 'Notice',
    message: escapeHtml(message),
    created_at: new Date().toISOString()
  };

  if (!BROADCASTS_DATA.some(bc => bc.headline === newBroadcast.headline && bc.message === newBroadcast.message)) {
    BROADCASTS_DATA.unshift(newBroadcast);
    renderBroadcastsList();
    renderFeed();
  }

  if (headlineEl) headlineEl.value = '';
  if (bodyEl) bodyEl.value = '';
  showToast('Notice Published', \`Broadcast live to \${category}.\`, 'send');
}`;

const newSubmitNotice = `async function submitNewNotice() {
  const audienceEl = document.getElementById('notice-audience');
  const categoryEl = document.getElementById('notice-category');
  const headlineEl = document.getElementById('notice-headline');
  const bodyEl = document.getElementById('notice-body');

  const audience = audienceEl ? audienceEl.value : 'Whole School';
  const category = categoryEl ? categoryEl.value : 'Academics';
  const headline = headlineEl ? headlineEl.value.trim() : '';
  const message = bodyEl ? bodyEl.value.trim() : '';

  if (!headline || headline.length < 4) {
    showToast('Validation Error', 'Announcement headline must be at least 4 characters long.', 'alert-triangle');
    if (headlineEl) headlineEl.focus();
    return;
  }
  if (!message || message.length < 8) {
    showToast('Validation Error', 'Announcement message must be at least 8 characters long.', 'alert-triangle');
    if (bodyEl) bodyEl.focus();
    return;
  }

  closeNewNoticeModal();

  let insertedId = 'bc-' + Date.now();
  if (supabase && STATE.currentUser) {
    try {
      const { data, error } = await supabase
        .from('broadcasts')
        .insert({
          headline: headline,
          message: message,
          audience: audience,
          category: category,
          published_by: STATE.currentUser.id
        })
        .select();

      if (error) throw error;
      if (data && data[0]?.id) insertedId = data[0].id;
      await logAuditEvent(\`Published school notice: "\${headline}" to \${audience}\`);
    } catch (err) {
      console.error('Failed to insert broadcast row:', err);
    }
  } else {
    await logAuditEvent(\`Published school notice: "\${headline}" to \${audience}\`);
  }

  const newBroadcast = {
    id: insertedId,
    headline: headline,
    audience: audience,
    category: category,
    author: STATE.currentUser ? STATE.currentUser.name : 'School Director',
    time: \`Today at \${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\`,
    message: message,
    created_at: new Date().toISOString()
  };

  if (!BROADCASTS_DATA.some(bc => bc.id === newBroadcast.id)) {
    BROADCASTS_DATA.unshift(newBroadcast);
  }
  renderBroadcastsList();
  renderFeed();
  if (typeof renderStudentFeed === 'function') renderStudentFeed();

  // Sync across tabs
  if (typeof syncCrossTabs === 'function') {
    syncCrossTabs('BROADCASTS_CHANGED', newBroadcast);
  }

  if (headlineEl) headlineEl.value = '';
  if (bodyEl) bodyEl.value = '';
  showToast('Notice Published', \`Broadcast dispatched live to \${audience}.\`, 'send');
}`;

if (content.includes(oldSubmitNotice)) {
  content = content.replace(oldSubmitNotice, newSubmitNotice);
  console.log('✓ Patched submitNewNotice with Audience selection and cross-tab sync');
}

// 5. In handlePublishBroadcast (Teacher form): sync cross tabs
const oldTeacherBcEnd = `  showToast('Broadcast Published', \`Dispatched live to \${audience}.\`, 'send');
}`;

const newTeacherBcEnd = `  showToast('Broadcast Published', \`Dispatched live to \${audience}.\`, 'send');
  if (typeof syncCrossTabs === 'function') {
    syncCrossTabs('BROADCASTS_CHANGED', newBroadcast);
  }
  if (typeof renderStudentFeed === 'function') renderStudentFeed();
}`;

if (content.includes(oldTeacherBcEnd)) {
  content = content.replace(oldTeacherBcEnd, newTeacherBcEnd);
  console.log('✓ Patched handlePublishBroadcast cross-tab sync');
}

// 6. In handleCreateTestSchedule & handleTeacherPageAddTest: sync cross tabs
const oldCreateTestEnd = `  showToast('Test Scheduled', \`Assessment scheduled for \${testDate}.\`, 'calendar-plus');
}`;

const newCreateTestEnd = `  showToast('Test Scheduled', \`Assessment scheduled for \${testDate}.\`, 'calendar-plus');
  if (typeof syncCrossTabs === 'function') {
    syncCrossTabs('TEST_SCHEDULE_CHANGED', {
      id: 'ts-' + Date.now(),
      teacher_id: teacherId,
      teacher_name: teacherName,
      class_section: classSec,
      subject: subject,
      date: testDate,
      topic: topic
    });
  }
}`;

if (content.includes(oldCreateTestEnd)) {
  content = content.replace(oldCreateTestEnd, newCreateTestEnd);
  console.log('✓ Patched handleCreateTestSchedule cross-tab sync');
}

const oldTeacherPageAddTestEnd = `    showToast('Test Scheduled', \`Assessment scheduled for Class \${classSec} on \${testDate}.\`, 'calendar-check');
    fetchTeacherTestSchedulePage();
    if (typeof fetchTeacherPlanner === 'function') fetchTeacherPlanner();
    if (typeof fetchDirectorTestSchedulePage === 'function') fetchDirectorTestSchedulePage();
  } catch (err) {`;

const newTeacherPageAddTestEnd = `    showToast('Test Scheduled', \`Assessment scheduled for Class \${classSec} on \${testDate}.\`, 'calendar-check');
    fetchTeacherTestSchedulePage();
    if (typeof fetchTeacherPlanner === 'function') fetchTeacherPlanner();
    if (typeof fetchDirectorTestSchedulePage === 'function') fetchDirectorTestSchedulePage();
    if (typeof fetchDirectorPlanner === 'function') fetchDirectorPlanner();
    if (typeof syncCrossTabs === 'function') {
      syncCrossTabs('TEST_SCHEDULE_CHANGED', {
        id: insertedId,
        teacher_id: teacherId,
        teacher_name: teacherName,
        class_section: classSec,
        subject: subject,
        date: testDate,
        topic: topic
      });
    }
  } catch (err) {`;

if (content.includes(oldTeacherPageAddTestEnd)) {
  content = content.replace(oldTeacherPageAddTestEnd, newTeacherPageAddTestEnd);
  console.log('✓ Patched handleTeacherPageAddTest cross-tab sync & director planner call');
}

// 7. In handleDeleteTestSchedule: sync cross tabs
const oldDeleteTestEnd = `  showToast('Test Removed', 'The assessment has been removed from schedule.', 'check');
  fetchTeacherTestSchedulePage();
  if (typeof fetchTeacherPlanner === 'function') fetchTeacherPlanner();
  if (typeof fetchDirectorTestSchedulePage === 'function') fetchDirectorTestSchedulePage();
}`;

const newDeleteTestEnd = `  showToast('Test Removed', 'The assessment has been removed from schedule.', 'check');
  fetchTeacherTestSchedulePage();
  if (typeof fetchTeacherPlanner === 'function') fetchTeacherPlanner();
  if (typeof fetchDirectorTestSchedulePage === 'function') fetchDirectorTestSchedulePage();
  if (typeof fetchDirectorPlanner === 'function') fetchDirectorPlanner();
  if (typeof syncCrossTabs === 'function') {
    syncCrossTabs('TEST_SCHEDULE_CHANGED', { id: testId, deleted: true });
  }
}`;

if (content.includes(oldDeleteTestEnd)) {
  content = content.replace(oldDeleteTestEnd, newDeleteTestEnd);
  console.log('✓ Patched handleDeleteTestSchedule cross-tab sync');
}

// 8. Update fetchDirectorPlanner to populate TEST_SCHEDULE_DATA and fallback
const oldFetchDirPlanner = `      const { data: tData, error: tErr } = await tQuery;
      if (!tErr && tData && tData.length > 0) {
        tests = tData.map(t => ({
          date: t.date,
          subject: t.subject,
          class_section: t.class_section,
          teacher_name: t.profiles ? t.profiles.full_name : 'Faculty Member',
          topic: t.topic
        }));
      }
    } catch (err) {
      console.warn('Director planner query:', err);
    }
  }`;

const newFetchDirPlanner = `      const { data: tData, error: tErr } = await tQuery;
      if (!tErr && tData && tData.length > 0) {
        tests = tData.map(t => ({
          id: t.id,
          date: t.date,
          subject: t.subject,
          class_section: t.class_section,
          teacher_name: t.profiles ? t.profiles.full_name : (t.teacher_name || 'Faculty Member'),
          topic: t.topic
        }));
        // Synchronize in-memory TEST_SCHEDULE_DATA
        tData.forEach(item => {
          const rec = {
            id: item.id,
            date: item.date,
            subject: item.subject,
            class_section: item.class_section,
            teacher_name: item.profiles ? item.profiles.full_name : (item.teacher_name || 'Faculty Member'),
            topic: item.topic
          };
          if (!TEST_SCHEDULE_DATA.some(ts => ts.id === rec.id || (ts.topic === rec.topic && ts.date === rec.date))) {
            TEST_SCHEDULE_DATA.push(rec);
          }
        });
      }
    } catch (err) {
      console.warn('Director planner query:', err);
    }
  }`;

if (content.includes(oldFetchDirPlanner)) {
  content = content.replace(oldFetchDirPlanner, newFetchDirPlanner);
  console.log('✓ Patched fetchDirectorPlanner');
}

// 9. In initStudentModules: call renderStudentFeed
const oldInitStudent = `  renderDigitalPassQR();
  animateHouseProgressBar();
}`;

const newInitStudent = `  renderDigitalPassQR();
  animateHouseProgressBar();
  if (typeof renderStudentFeed === 'function') renderStudentFeed();
}`;

if (content.includes(oldInitStudent)) {
  content = content.replace(oldInitStudent, newInitStudent);
  console.log('✓ Patched initStudentModules to call renderStudentFeed');
}

// 10. In navigateTo: call renderStudentFeed if page-student-dashboard
const oldNavStudent = `if (pageId === 'page-student-dashboard') {
    if (typeof fetchStudentDashboardStats === 'function') fetchStudentDashboardStats();
  }`;

const newNavStudent = `if (pageId === 'page-student-dashboard') {
    if (typeof fetchStudentDashboardStats === 'function') fetchStudentDashboardStats();
    if (typeof renderStudentFeed === 'function') renderStudentFeed();
  }`;

if (content.includes(oldNavStudent)) {
  content = content.replace(oldNavStudent, newNavStudent);
  console.log('✓ Patched navigateTo for page-student-dashboard');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Completed all patches. Final size:', content.length);
