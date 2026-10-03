const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'BrainzOS.html');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Original size:', content.length);

// 1. Notice Modal Audience Dropdown
const oldModalCategory = `<div class="form-group">
<label class="form-label" for="notice-category">Channel / Category (Audience)</label>
<select id="notice-category" style="width: 100%; padding: 12px 14px; border-radius: var(--radius-md); background: rgba(248, 244, 237, 0.6); border: 1px solid var(--color-border-warm);">
<option value="Whole School">Whole School</option>
<option value="Operations">Operations</option>
<option value="Academics">Academics</option>
<option value="Student Life">Student Life</option>
<option value="IT">IT Systems</option>
<option value="Staff Only">Staff Only</option>
</select>
</div>`;

const newModalCategory = `<div class="form-group">
<label class="form-label" for="notice-audience">Target Audience</label>
<select id="notice-audience" class="composer-select" style="width: 100%; padding: 12px 14px; border-radius: var(--radius-md); background: rgba(248, 244, 237, 0.6); border: 1px solid var(--color-border-warm);">
<option value="Whole School">Whole School (Both Students &amp; Teachers)</option>
<option value="Students Only">Students Only</option>
<option value="Teachers Only">Teachers Only (Staff &amp; Faculty)</option>
</select>
</div>
<div class="form-group">
<label class="form-label" for="notice-category">Channel / Category</label>
<select id="notice-category" class="composer-select" style="width: 100%; padding: 12px 14px; border-radius: var(--radius-md); background: rgba(248, 244, 237, 0.6); border: 1px solid var(--color-border-warm);">
<option value="Academics">Academics &amp; Curriculum</option>
<option value="Operations">Operations &amp; Campus</option>
<option value="Student Life">Student Life &amp; Activities</option>
<option value="IT">IT Systems &amp; Infrastructure</option>
</select>
</div>`;

if (content.includes(oldModalCategory)) {
  content = content.replace(oldModalCategory, newModalCategory);
  console.log('✓ Patched Notice Modal Target Audience');
} else {
  console.warn('Could not find oldModalCategory');
}

// 2. Student Feed Container ID
const oldStudentFeed = `<!-- Live School Feed Activity Stream -->
<div class="card">
<div class="bento-card-title-row">
<div>
<h3>Live School Feed</h3>
<div class="subtext" style="margin-top: 2px;">Campus bulletin &amp; society dispatches</div>
</div>
<span class="badge badge-sage">
<span class="status-dot"></span>
<span>Live</span>
</span>
</div>
<div class="feed-stream">`;

const newStudentFeed = `<!-- Live School Feed Activity Stream -->
<div class="card">
<div class="bento-card-title-row">
<div>
<h3>Live School Feed</h3>
<div class="subtext" style="margin-top: 2px;">Campus bulletin &amp; society dispatches</div>
</div>
<span class="badge badge-sage">
<span class="status-dot"></span>
<span>Live</span>
</span>
</div>
<div class="feed-stream" id="student-feed-container">`;

if (content.includes(oldStudentFeed)) {
  content = content.replace(oldStudentFeed, newStudentFeed);
  console.log('✓ Patched Student Feed Container ID');
} else {
  console.warn('Could not find oldStudentFeed');
}

// 3. Cross-Tab Sync Engine injection
const stateMarker = `window.STATE = STATE;`;
const syncEngineCode = `window.STATE = STATE;

/* =========================================================================
   CROSS-TAB & FULL-STACK REALTIME SYNCHRONIZATION ENGINE
   ========================================================================= */
const BRAINZOS_CHANNEL = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('brainzos_sync_channel') : null;

function syncCrossTabs(actionType, payload) {
  if (BRAINZOS_CHANNEL) {
    try {
      BRAINZOS_CHANNEL.postMessage({ type: actionType, payload: payload, timestamp: Date.now() });
    } catch (e) {}
  }
  try {
    localStorage.setItem('brainzos_sync_signal', JSON.stringify({ type: actionType, payload: payload, timestamp: Date.now() }));
  } catch (e) {}
}

function handleCrossTabSyncEvent(eventData) {
  if (!eventData || !eventData.type) return;
  const { type, payload } = eventData;

  if (type === 'TEST_SCHEDULE_CHANGED') {
    if (payload && !payload.deleted && Array.isArray(TEST_SCHEDULE_DATA)) {
      if (!TEST_SCHEDULE_DATA.some(t => t.id === payload.id || (t.topic === payload.topic && t.date === payload.date))) {
        TEST_SCHEDULE_DATA.push(payload);
      }
    } else if (payload && payload.deleted && payload.id && Array.isArray(TEST_SCHEDULE_DATA)) {
      const idx = TEST_SCHEDULE_DATA.findIndex(t => t.id === payload.id);
      if (idx !== -1) TEST_SCHEDULE_DATA.splice(idx, 1);
    }
    if (typeof fetchDirectorPlanner === 'function' && document.getElementById('director-planner-tests-tbody')) {
      fetchDirectorPlanner();
    }
    if (typeof fetchDirectorTestSchedulePage === 'function' && document.getElementById('director-test-schedule-page-tbody')) {
      fetchDirectorTestSchedulePage();
    }
    if (typeof fetchTeacherTestSchedulePage === 'function' && document.getElementById('teacher-test-schedule-page-tbody')) {
      fetchTeacherTestSchedulePage();
    }
    if (typeof fetchTeacherPlanner === 'function' && document.getElementById('teacher-planner-tests-tbody')) {
      fetchTeacherPlanner();
    }
  } else if (type === 'BROADCASTS_CHANGED') {
    if (payload && Array.isArray(BROADCASTS_DATA)) {
      if (!BROADCASTS_DATA.some(b => b.id === payload.id || (b.headline === payload.headline && b.message === payload.message))) {
        BROADCASTS_DATA.unshift(payload);
      }
    }
    if (typeof fetchBroadcasts === 'function') fetchBroadcasts();
    if (typeof renderBroadcastsList === 'function') renderBroadcastsList();
    if (typeof renderFeed === 'function') renderFeed();
    if (typeof renderStudentFeed === 'function') renderStudentFeed();
  } else if (type === 'ASSIGNMENTS_CHANGED') {
    if (typeof fetchTeacherAssignments === 'function') fetchTeacherAssignments();
    if (typeof fetchStudentAssignments === 'function') fetchStudentAssignments();
  }
}

if (BRAINZOS_CHANNEL) {
  BRAINZOS_CHANNEL.onmessage = (e) => {
    if (e && e.data) handleCrossTabSyncEvent(e.data);
  };
}

window.addEventListener('storage', (e) => {
  if (e.key === 'brainzos_sync_signal' && e.newValue) {
    try {
      const parsed = JSON.parse(e.newValue);
      handleCrossTabSyncEvent(parsed);
    } catch (err) {}
  }
});`;

if (content.includes(stateMarker) && !content.includes('BRAINZOS_CHANNEL')) {
  content = content.replace(stateMarker, syncEngineCode);
  console.log('✓ Injected Cross-Tab Sync Engine');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Saved preliminary patches. New size:', content.length);
