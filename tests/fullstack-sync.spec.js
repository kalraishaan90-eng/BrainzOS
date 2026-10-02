const { test, expect, chromium } = require('@playwright/test');

test('Cross-tab test schedule rollup and audience-separated broadcasts', async () => {
  const browser = await chromium.launch({ headless: true });

  // 1. Create Teacher Context
  const teacherContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();
  await teacherPage.goto('http://127.0.0.1:8080/BrainzOS.html');
  await teacherPage.fill('#school-email', 'teacher@brainz.edu');
  await teacherPage.fill('#school-password', 'Password123!');
  await teacherPage.click('#continue-btn');
  await expect(teacherPage.locator('#app-viewport')).toHaveClass(/active-view/, { timeout: 10000 });
  await teacherPage.click('#nav-teacher-test-schedule');
  await expect(teacherPage.locator('#page-teacher-test-schedule')).toHaveClass(/active-page/);

  // 2. Create Director Context
  const directorContext = await browser.newContext();
  const directorPage = await directorContext.newPage();
  await directorPage.goto('http://127.0.0.1:8080/BrainzOS.html');
  await directorPage.fill('#school-email', 'director@brainz.edu');
  await directorPage.fill('#school-password', 'Password123!');
  await directorPage.click('#continue-btn');
  await expect(directorPage.locator('#app-viewport')).toHaveClass(/active-view/, { timeout: 10000 });
  await directorPage.click('#nav-director-planner');
  await expect(directorPage.locator('#page-director-planner')).toHaveClass(/active-page/);

  // 3. Create Student Context
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await studentPage.goto('http://127.0.0.1:8080/BrainzOS.html');
  await studentPage.fill('#school-email', 'student@brainz.edu');
  await studentPage.fill('#school-password', 'Password123!');
  await studentPage.click('#continue-btn');
  await expect(studentPage.locator('#app-viewport')).toHaveClass(/active-view/, { timeout: 10000 });
  await expect(studentPage.locator('#page-student-dashboard')).toHaveClass(/active-page/);

  console.log('--- Step 1: Teacher schedules an upcoming test ---');
  await teacherPage.fill('#teacher-page-test-topic', 'Judicial Review & Federal Structure');
  await teacherPage.fill('#teacher-page-test-date', '2026-10-18');
  await teacherPage.click('#teacher-test-submit-btn');

  // Verify test appears in Teacher test schedule page
  await expect(teacherPage.locator('#teacher-test-schedule-page-tbody')).toContainText('Judicial Review & Federal Structure', { timeout: 10000 });
  console.log('✓ Teacher view confirmed test added');

  console.log('--- Step 2: Director Curriculum & Test Rollup receives the test in real time ---');
  await expect(directorPage.locator('#director-planner-tests-tbody')).toContainText('Judicial Review & Federal Structure', { timeout: 10000 });
  console.log('✓ Director Planner confirmed test received');

  console.log('--- Step 3: Director publishes "Students Only" announcement ---');
  await directorPage.click('#nav-director-feed');
  await expect(directorPage.locator('#page-director-feed')).toHaveClass(/active-page/);
  await directorPage.evaluate(() => {
    openNewNoticeModal();
    document.getElementById('notice-audience').value = 'Students Only';
    document.getElementById('notice-headline').value = 'Inter-House Debate Finals Schedule';
    document.getElementById('notice-body').value = 'Debate finals will commence at 10 AM in the Main Auditorium.';
    submitNewNotice();
  });

  // Verify Student Dashboard has notice
  await expect(studentPage.locator('#student-feed-container')).toContainText('Inter-House Debate Finals Schedule', { timeout: 10000 });
  console.log('✓ Student Dashboard received Students Only announcement');

  // Verify Teacher Broadcasts does NOT have notice
  await teacherPage.click('#nav-teacher-broadcasts');
  await expect(teacherPage.locator('#page-teacher-broadcasts')).toHaveClass(/active-page/);
  await teacherPage.waitForTimeout(500);
  await expect(teacherPage.locator('#announcements-feed-container')).not.toContainText('Inter-House Debate Finals Schedule');
  console.log('✓ Teacher Broadcasts correctly hides Students Only announcement');

  console.log('--- Step 4: Director publishes "Teachers Only" announcement ---');
  await directorPage.evaluate(() => {
    openNewNoticeModal();
    document.getElementById('notice-audience').value = 'Teachers Only';
    document.getElementById('notice-headline').value = 'Staff Moderation Submission Deadline';
    document.getElementById('notice-body').value = 'Please submit all internal marks spreadsheets by Thursday noon.';
    submitNewNotice();
  });

  // Verify Teacher Broadcasts receives notice
  await expect(teacherPage.locator('#announcements-feed-container')).toContainText('Staff Moderation Submission Deadline', { timeout: 10000 });
  console.log('✓ Teacher Broadcasts received Teachers Only announcement');

  // Verify Student Dashboard does NOT receive notice
  await expect(studentPage.locator('#student-feed-container')).not.toContainText('Staff Moderation Submission Deadline');
  console.log('✓ Student Dashboard correctly hides Teachers Only announcement');

  console.log('--- Step 5: Director publishes "Whole School" announcement ---');
  await directorPage.evaluate(() => {
    openNewNoticeModal();
    document.getElementById('notice-audience').value = 'Whole School';
    document.getElementById('notice-headline').value = 'Annual Sports Day Date Finalized';
    document.getElementById('notice-body').value = 'Track and field events scheduled for next Saturday.';
    submitNewNotice();
  });

  // Both should receive Whole School notice
  await expect(studentPage.locator('#student-feed-container')).toContainText('Annual Sports Day Date Finalized', { timeout: 10000 });
  await expect(teacherPage.locator('#announcements-feed-container')).toContainText('Annual Sports Day Date Finalized', { timeout: 10000 });
  console.log('✓ Both Student and Teacher received Whole School announcement');

  console.log('ALL CROSS-TAB & FULL-STACK CONNECTIVITY CHECKS PASSED!');
  await browser.close();
});
