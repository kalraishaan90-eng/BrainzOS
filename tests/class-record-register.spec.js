const { test, expect } = require('@playwright/test');

// Test accounts seeded in Supabase
const ACCOUNTS = {
  student: { email: 'student@brainz.edu', password: 'Password123!' },
  teacher: { email: 'teacher@brainz.edu', password: 'Password123!' },
  director: { email: 'director@brainz.edu', password: 'Password123!' }
};

async function loginAs(page, role) {
  const creds = ACCOUNTS[role];
  await page.goto('/BrainzOS.html');
  await page.evaluate(async () => {
    try {
      if (typeof logoutUser === 'function') await logoutUser();
    } catch (e) {}
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
  });
  await page.goto('/BrainzOS.html');
  await expect(page.locator('#login-viewport')).toBeVisible({ timeout: 10000 });

  await page.fill('#school-email', creds.email);
  await page.fill('#school-password', creds.password);
  await page.click('#continue-btn');

  await expect(page.locator('#app-viewport')).toHaveClass(/active-view/, { timeout: 10000 });
}

test.describe('Class Record Register Suite', () => {

  test('1. Navigation & Access Control: Teacher & Director have access; Student is barred', async ({ page }) => {
    // 1.1 Student check: Student must NOT have nav item
    await loginAs(page, 'student');
    await expect(page.locator('#nav-teacher-student-records')).toHaveCount(0);
    await expect(page.locator('#nav-director-student-records')).toHaveCount(0);

    // If student attempts to force-route to page-student-records via JS or hash
    await page.evaluate(() => navigateTo('page-student-records'));
    await expect(page.locator('#page-student-records')).not.toHaveClass(/active-page/);
    await expect(page.locator('#page-student-dashboard')).toHaveClass(/active-page/);

    // 1.2 Teacher check: Has nav item and can visit page-student-records
    await loginAs(page, 'teacher');
    const teacherNav = page.locator('#nav-teacher-student-records');
    await expect(teacherNav).toBeVisible();
    await teacherNav.click();
    await expect(page.locator('#page-student-records')).toHaveClass(/active-page/);

    // 1.3 Director check: Has nav item and can visit page-student-records
    await loginAs(page, 'director');
    const directorNav = page.locator('#nav-director-student-records');
    await expect(directorNav).toBeVisible();
    await directorNav.click();
    await expect(page.locator('#page-student-records')).toHaveClass(/active-page/);
  });

  test('2. Search & Section Isolation: Teacher sees only assigned section; Director sees all', async ({ page }) => {
    // Teacher Aarav Mehta (assigned to Class XI-B)
    await loginAs(page, 'teacher');
    await page.click('#nav-teacher-student-records');
    await expect(page.locator('#page-student-records')).toHaveClass(/active-page/);

    // Search input
    const searchInput = page.locator('#student-record-search-input');
    await expect(searchInput).toBeVisible();

    // Teacher can find Ishaan Kalra (Class XI-B)
    await searchInput.fill('Ishaan');
    await page.waitForTimeout(300);
    await expect(page.locator('#student-records-list')).toContainText('Ishaan Kalra');
    await expect(page.locator('#student-records-list')).toContainText('Class XI-B');

    // Teacher searches for student in Class XI-A (Siddharth Rao) - MUST NOT BE FOUND
    await searchInput.fill('Siddharth');
    await page.waitForTimeout(300);
    await expect(page.locator('#student-records-list')).not.toContainText('Siddharth Rao');
    await expect(page.locator('#student-records-list')).toContainText('No Matching Scholar Records Found');

    // Director logs in: Director CAN see both XI-B and XI-A / XII-A scholars
    await loginAs(page, 'director');
    await page.click('#nav-director-student-records');
    await expect(page.locator('#page-student-records')).toHaveClass(/active-page/);

    const dirSearch = page.locator('#student-record-search-input');
    await dirSearch.fill('Ishaan');
    await page.waitForTimeout(300);
    await expect(page.locator('#student-records-list')).toContainText('Ishaan Kalra');

    await dirSearch.fill('Siddharth');
    await page.waitForTimeout(300);
    await expect(page.locator('#student-records-list')).toContainText('Siddharth Rao');
    await expect(page.locator('#student-records-list')).toContainText('Class XI-A');
  });

  test('3. Student Record Page Demographics, Summary Cards & Privacy Notice', async ({ page }) => {
    await loginAs(page, 'teacher');
    await page.click('#nav-teacher-student-records');
    await expect(page.locator('#page-student-records')).toHaveClass(/active-page/);

    // Search and select Ishaan Kalra
    await page.fill('#student-record-search-input', 'Ishaan');
    await page.waitForTimeout(300);
    await page.locator('.student-record-card').first().click();

    // Verify Cumulative Record View opened
    await expect(page.locator('#page-student-record-view')).toHaveClass(/active-page/);
    await expect(page.locator('#srec-name')).toHaveText('Ishaan Kalra');
    await expect(page.locator('#srec-id-code')).toHaveText('BOS-XIB-041');
    await expect(page.locator('#srec-badge-class')).toHaveText('Class XI-B');
    await expect(page.locator('#srec-badge-house')).toContainText('Takshashila');

    // Verify stat cards from student_record_summary
    await expect(page.locator('#srec-stat-attendance')).toBeVisible();
    await expect(page.locator('#srec-stat-grade')).toBeVisible();
    await expect(page.locator('#srec-stat-notes-count')).toBeVisible();

    // Verify Privacy notice
    await expect(page.locator('text=Staff-only. Not visible to students or parents.')).toBeVisible();

    // Verify tabs
    await expect(page.locator('#srec-tab-btn-notes')).toHaveClass(/active/);
    await page.click('#srec-tab-btn-attendance');
    await expect(page.locator('#srec-pane-attendance')).toBeVisible();
    await page.click('#srec-tab-btn-grades');
    await expect(page.locator('#srec-pane-grades')).toBeVisible();
    await page.click('#srec-tab-btn-assignments');
    await expect(page.locator('#srec-pane-assignments')).toBeVisible();
    await page.click('#srec-tab-btn-notes');
    await expect(page.locator('#srec-pane-notes')).toBeVisible();
  });

  test('4. Confidential Notes: Add, Form Validation, Category Filtering & Health/Welfare Privacy', async ({ page }) => {
    // 4.1 Teacher view: Check health_welfare note recorded by Ms. Ananya Sen is HIDDEN from Aarav Mehta
    await loginAs(page, 'teacher');
    await page.click('#nav-teacher-student-records');
    await page.fill('#student-record-search-input', 'Ishaan');
    await page.waitForTimeout(300);
    await page.locator('.student-record-card').first().click();
    await expect(page.locator('#page-student-record-view')).toHaveClass(/active-page/);

    // Verify health_welfare note is hidden for this teacher
    await expect(page.locator('#student-notes-timeline')).not.toContainText('mild asthma exacerbation');

    // Test form validation: empty note
    await page.click('#btn-save-student-note');
    await expect(page.locator('#new-note-validation-msg')).toBeVisible();
    await expect(page.locator('#new-note-validation-msg')).toContainText('Note cannot be empty');

    // Add valid note
    await page.selectOption('#new-note-category', 'achievement');
    await page.fill('#new-note-text', 'Outstanding performance in National Macroeconomic Quiz. Secured top band distinction.');
    await page.click('#btn-save-student-note');

    // Verify toast & timeline updated
    await expect(page.locator('#app-toast')).toBeVisible();
    await expect(page.locator('#student-notes-timeline')).toContainText('Outstanding performance in National Macroeconomic Quiz.');
    await expect(page.locator('#student-notes-timeline')).toContainText('Achievement');

    // 4.2 Director view: Health/welfare note MUST be visible to Director
    await loginAs(page, 'director');
    await page.click('#nav-director-student-records');
    await page.fill('#student-record-search-input', 'Ishaan');
    await page.waitForTimeout(300);
    await page.locator('.student-record-card').first().click();
    await expect(page.locator('#page-student-record-view')).toHaveClass(/active-page/);

    // Health_welfare note is visible to Director
    await expect(page.locator('#student-notes-timeline')).toContainText('mild asthma exacerbation');
    await expect(page.locator('#student-notes-timeline')).toContainText('Health & Welfare');
  });

  test('5. Edit & Delete Note with Audit Confirmation', async ({ page }) => {
    await loginAs(page, 'director');
    await page.click('#nav-director-student-records');
    await page.fill('#student-record-search-input', 'Ishaan');
    await page.waitForTimeout(300);
    await page.locator('.student-record-card').first().click();
    await expect(page.locator('#page-student-record-view')).toHaveClass(/active-page/);

    // Add a specific test note to edit and delete
    await page.selectOption('#new-note-category', 'behaviour');
    await page.fill('#new-note-text', 'Temporary observation regarding morning lab equipment handling.');
    await page.click('#btn-save-student-note');
    await expect(page.locator('#student-notes-timeline')).toContainText('Temporary observation regarding morning lab equipment handling.');

    // Edit the note
    const noteCard = page.locator('.student-note-item', { hasText: 'Temporary observation regarding morning lab equipment handling.' });
    await noteCard.locator('button:has-text("Edit")').first().click();
    await expect(page.locator('#edit-student-note-modal')).toHaveClass(/active/);

    await page.fill('#edit-note-text', 'Updated observation: Scholar reconciled all lab equipment with safety cert.');
    await page.click('#btn-save-edit-note');
    await expect(page.locator('#edit-student-note-modal')).not.toHaveClass(/active/);
    await expect(page.locator('#student-notes-timeline')).toContainText('Updated observation: Scholar reconciled all lab equipment with safety cert.');

    // Delete the note
    const updatedCard = page.locator('.student-note-item', { hasText: 'Updated observation: Scholar reconciled all lab equipment with safety cert.' });
    await updatedCard.locator('button:has-text("Delete")').first().click();
    await expect(page.locator('#delete-student-note-modal')).toHaveClass(/active/);

    await page.click('#btn-confirm-delete-note');
    await expect(page.locator('#delete-student-note-modal')).not.toHaveClass(/active/);
    await expect(page.locator('#student-notes-timeline')).not.toContainText('Updated observation: Scholar reconciled all lab equipment with safety cert.');
  });

  test('6. Command Launcher (Cmd+K) wired to Student Records', async ({ page }) => {
    await loginAs(page, 'teacher');
    await page.click('.search-trigger');
    await expect(page.locator('#cmd-overlay')).toHaveClass(/active/);

    // Type student name in launcher
    await page.fill('#cmd-input', 'Ishaan');
    await page.waitForTimeout(200);

    // Expect Ishaan Kalra result
    const studentCmd = page.locator('.cmd-item', { hasText: 'Ishaan Kalra' });
    await expect(studentCmd).toBeVisible();
    await expect(studentCmd).toContainText('Class XI-B');

    // Click student in launcher -> navigates to Student Record page
    await studentCmd.click();
    await expect(page.locator('#cmd-overlay')).not.toHaveClass(/active/);
    await expect(page.locator('#page-student-record-view')).toHaveClass(/active-page/);
    await expect(page.locator('#srec-name')).toHaveText('Ishaan Kalra');
  });

  test('7. Download Record (PDF/print view) button produces clean print preview', async ({ page }) => {
    await loginAs(page, 'teacher');
    await page.click('#nav-teacher-student-records');
    await page.fill('#student-record-search-input', 'Ishaan');
    await page.waitForTimeout(300);
    await page.locator('.student-record-card').first().click();
    await expect(page.locator('#page-student-record-view')).toHaveClass(/active-page/);

    const exportBtn = page.locator('#srec-export-btn');
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toContainText('Download record (PDF/print view)');

    // Mock window.print
    let printCalled = false;
    await page.exposeFunction('mockPrint', () => { printCalled = true; });
    await page.evaluate(() => {
      window.print = window.mockPrint;
    });

    await exportBtn.click();
    expect(printCalled).toBe(true);
  });

});
