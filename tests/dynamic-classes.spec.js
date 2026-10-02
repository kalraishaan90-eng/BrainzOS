const { test, expect } = require('@playwright/test');

test.describe('Dynamic Class Sections & Multi-Section Isolation', () => {

  test('1. Add Teacher validation requires at least one class section', async ({ page }) => {
    await page.goto('/BrainzOS.html');
    await expect(page.locator('#login-viewport')).toBeVisible();

    await page.fill('#school-email', 'director@brainz.edu');
    await page.fill('#school-password', 'Password123!');
    await page.click('#continue-btn');
    await expect(page.locator('#app-viewport')).toHaveClass(/active-view/, { timeout: 10000 });

    await page.click('#nav-director-teachers');
    await expect(page.locator('#page-director-teachers')).toHaveClass(/active-page/);

    // Fill teacher name & email without selecting any classes
    await page.fill('#new-teacher-name', 'Prof. Zero Class');
    await page.fill('#new-teacher-email', 'zero.class@brainz.edu');

    // Attempt submission
    await page.click('#btn-create-teacher-submit');

    // Inline validation error must be displayed
    const valError = page.locator('#faculty-classes-validation-error');
    await expect(valError).toBeVisible();
    await expect(valError).toContainText('Please select at least one class section');

    // Success box must NOT be visible
    await expect(page.locator('#add-teacher-success')).not.toBeVisible();
  });

  test('2. Director provisions faculty with Grade 3, Grade 8, and XII Science', async ({ page }) => {
    await page.goto('/BrainzOS.html');
    await page.fill('#school-email', 'director@brainz.edu');
    await page.fill('#school-password', 'Password123!');
    await page.click('#continue-btn');
    await expect(page.locator('#app-viewport')).toHaveClass(/active-view/, { timeout: 10000 });

    await page.click('#nav-director-teachers');
    await expect(page.locator('#page-director-teachers')).toHaveClass(/active-page/);

    // Expand Grade 1-5, Grade 6-8, and Grade 11-12 groups if not already expanded
    const expandGroup = async (gid) => {
      const body = page.locator(`#fg-body-${gid}`);
      if (!(await body.isVisible())) {
        await page.click(`#fg-card-${gid} .faculty-group-header`);
        await expect(body).toBeVisible();
      }
    };

    await expandGroup('g1_5');
    await expandGroup('g6_8');
    await expandGroup('g11_12');

    // Select 3-A, 8-A, and XII-A Science using accessible checkboxes
    const chk3A = page.getByRole('checkbox', { name: '3-A', exact: true });
    await expect(chk3A).toBeVisible();
    await chk3A.check();

    const chk8A = page.getByRole('checkbox', { name: '8-A', exact: true });
    await expect(chk8A).toBeVisible();
    await chk8A.check();

    const chk12Sci = page.getByRole('checkbox', { name: /XII-A.*Science/ });
    await expect(chk12Sci).toBeVisible();
    await chk12Sci.check();

    // Verify chips container shows 3 selected classes
    const chipsWrap = page.locator('#faculty-selected-classes-wrap');
    await expect(chipsWrap).toBeVisible();
    await expect(page.locator('#faculty-selected-count')).toHaveText('3');
    await expect(page.locator('#faculty-selected-chips')).toContainText('3-A');
    await expect(page.locator('#faculty-selected-chips')).toContainText('8-A');
    await expect(page.locator('#faculty-selected-chips')).toContainText('XII-A');

    // Fill teacher details
    const teacherName = 'Prof. Rajesh Sharma';
    const teacherEmail = `rajesh.sharma.${Date.now()}@brainz.edu`;
    await page.fill('#new-teacher-name', teacherName);
    await page.fill('#new-teacher-email', teacherEmail);

    // Provision account
    await page.click('#btn-create-teacher-submit');

    // Verify success confirmation card
    const successBox = page.locator('#add-teacher-success');
    await expect(successBox).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#success-teacher-name')).toHaveText(teacherName);
    await expect(page.locator('#success-teacher-email')).toHaveText(teacherEmail);

    const tempPwd = (await page.locator('#success-teacher-pwd').textContent()).trim();
    expect(tempPwd.length).toBeGreaterThan(5);

    // Verify directory table lists the new teacher with their assigned classes
    const tableRow = page.locator('#director-faculty-table-body tr').filter({ hasText: teacherEmail });
    await expect(tableRow).toBeVisible();
    await expect(tableRow).toContainText('3-A');
    await expect(tableRow).toContainText('8-A');
    await expect(tableRow).toContainText('XII-A');
  });

  test('3. Teacher sees only their assigned classes (3-A, 8-A, XII-A) and XI-B teacher cannot see them', async ({ page }) => {
    // 3a. Provision multi-class teacher first
    await page.goto('/BrainzOS.html');
    await page.fill('#school-email', 'director@brainz.edu');
    await page.fill('#school-password', 'Password123!');
    await page.click('#continue-btn');
    await expect(page.locator('#app-viewport')).toHaveClass(/active-view/, { timeout: 10000 });

    await page.click('#nav-director-teachers');
    await page.locator('#fg-card-g1_5 .faculty-group-header').click();
    await page.getByRole('checkbox', { name: '3-A', exact: true }).check();

    await page.locator('#fg-card-g6_8 .faculty-group-header').click();
    await page.getByRole('checkbox', { name: '8-A', exact: true }).check();

    await page.getByRole('checkbox', { name: /XII-A.*Science/ }).check();

    const tName = 'Dr. Meenakshi Sundaram';
    const tEmail = `meenakshi.${Date.now()}@brainz.edu`;
    await page.fill('#new-teacher-name', tName);
    await page.fill('#new-teacher-email', tEmail);
    await page.click('#btn-create-teacher-submit');

    await expect(page.locator('#add-teacher-success')).toBeVisible({ timeout: 10000 });
    const tempPassword = (await page.locator('#success-teacher-pwd').textContent()).trim();

    // 3b. Log out and log in as newly provisioned teacher
    await page.locator('.header-logout-btn, button[title="Sign Out"], .user-logout-btn').first().click();
    await expect(page.locator('#login-viewport')).toBeVisible();

    await page.fill('#school-email', tEmail);
    await page.fill('#school-password', tempPassword);
    await page.click('#continue-btn');
    await expect(page.locator('#app-viewport')).toHaveClass(/active-view/, { timeout: 10000 });

    // Verify topbar role indicates faculty
    await expect(page.locator('#topbar-user-role')).toContainText(/Faculty/i);

    // Navigate to Class Record Register
    await page.click('#nav-teacher-student-records');
    await expect(page.locator('#page-student-records')).toHaveClass(/active-page/);

    // Dr. Meenakshi teaches 3-A, 8-A, XII-A:
    // Should see Ananya Gupta (3-A), Kabir Singh (8-A), Riya Malhotra (XII-A)
    const listEl = page.locator('#student-records-list');
    await expect(listEl).toContainText('Ananya Gupta');
    await expect(listEl).toContainText('Kabir Singh');
    await expect(listEl).toContainText('Riya Malhotra');

    // Should NOT see Ishaan Kalra (XI-B)
    await expect(listEl).not.toContainText('Ishaan Kalra');

    // Check Attendance Reports filter options for this teacher
    await page.click('#nav-teacher-attendance-reports');
    await expect(page.locator('#page-teacher-attendance-reports')).toHaveClass(/active-page/);
    const teacherFilterOptions = await page.locator('#teacher-att-filter-class option').allInnerTexts();
    expect(teacherFilterOptions.some(o => o.includes('3-A'))).toBeTruthy();
    expect(teacherFilterOptions.some(o => o.includes('8-A'))).toBeTruthy();
    expect(teacherFilterOptions.some(o => o.includes('XII-A'))).toBeTruthy();
    expect(teacherFilterOptions.some(o => o.includes('XI-B'))).toBeFalsy();

    // 3c. Log out and log in as default teacher (who only teaches XI-B)
    await page.locator('.header-logout-btn, button[title="Sign Out"], .user-logout-btn').first().click();
    await expect(page.locator('#login-viewport')).toBeVisible();

    await page.fill('#school-email', 'teacher@brainz.edu');
    await page.fill('#school-password', 'Password123!');
    await page.click('#continue-btn');
    await expect(page.locator('#app-viewport')).toHaveClass(/active-view/, { timeout: 10000 });

    // Navigate to Class Record Register as default teacher
    await page.click('#nav-teacher-student-records');
    await expect(page.locator('#page-student-records')).toHaveClass(/active-page/);

    const defaultTeacherList = page.locator('#student-records-list');
    // Default teacher MUST see Ishaan Kalra (XI-B)
    await expect(defaultTeacherList).toContainText('Ishaan Kalra');

    // Default teacher MUST NOT see 3-A or 8-A or XII-A students
    await expect(defaultTeacherList).not.toContainText('Kabir Singh');
    await expect(defaultTeacherList).not.toContainText('Riya Malhotra');
  });

  test('4. Director adds new class section via Manage Classes and it appears in all audited forms', async ({ page }) => {
    await page.goto('/BrainzOS.html');
    await page.fill('#school-email', 'director@brainz.edu');
    await page.fill('#school-password', 'Password123!');
    await page.click('#continue-btn');
    await expect(page.locator('#app-viewport')).toHaveClass(/active-view/, { timeout: 10000 });

    // Navigate to Director Faculty Roster
    await page.click('#nav-director-teachers');
    await expect(page.locator('#page-director-teachers')).toHaveClass(/active-page/);

    // Open Manage Classes modal
    await page.locator('button', { hasText: 'Manage Classes' }).first().click();
    const modal = page.locator('#modal-manage-classes');
    await expect(modal).toBeVisible();

    // Add new section: Grade 5, Section E
    await page.selectOption('#mc-new-grade', '5');
    await page.fill('#mc-new-section', 'E');
    await page.click('#btn-mc-submit-add');

    // Verify newly added section is in the Manage Classes table
    await expect(page.locator('#mc-sections-tbody')).toContainText('Class 5-E');

    // Close Manage Classes modal
    await page.locator('#modal-manage-classes button', { hasText: 'Done' }).click();
    await expect(modal).not.toBeVisible();

    // 1. Verify in Add Faculty form (under Grade 1-5 group)
    const g15Header = page.locator('#fg-card-g1_5 .faculty-group-header');
    if (!(await page.locator('#fg-body-g1_5').isVisible())) {
      await g15Header.click();
    }
    await expect(page.locator('#fg-body-g1_5')).toContainText('5-E');

    // 2. Verify in Attendance Reports filter (#director-att-filter-class)
    await page.click('#nav-director-attendance-reports');
    await expect(page.locator('#page-director-attendance-reports')).toHaveClass(/active-page/);
    const dirAttOptions = await page.locator('#director-att-filter-class option').allInnerTexts();
    expect(dirAttOptions.some(opt => opt.includes('5-E'))).toBeTruthy();

    // 3. Verify in Master Test Schedule filter (#director-test-filter-class)
    await page.click('#nav-director-test-schedule');
    await expect(page.locator('#page-director-test-schedule')).toHaveClass(/active-page/);
    const dirTestOptions = await page.locator('#director-test-filter-class option').allInnerTexts();
    expect(dirTestOptions.some(opt => opt.includes('5-E'))).toBeTruthy();

    // 4. Verify in Lecture Planner filter (#director-planner-cohort-filter)
    await page.click('#nav-director-planner');
    await expect(page.locator('#page-director-planner')).toHaveClass(/active-page/);
    const dirPlannerOptions = await page.locator('#director-planner-cohort-filter option').allInnerTexts();
    expect(dirPlannerOptions.some(opt => opt.includes('5-E'))).toBeTruthy();

    // 5. Verify in Staff Leave & Substitutions (#sub-cohort-select)
    await page.click('#nav-director-leave');
    await expect(page.locator('#page-director-leave')).toHaveClass(/active-page/);
    const subOptions = await page.locator('#sub-cohort-select option').allInnerTexts();
    expect(subOptions.some(opt => opt.includes('5-E'))).toBeTruthy();
  });
});
