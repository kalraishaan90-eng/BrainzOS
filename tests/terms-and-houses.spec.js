const { test, expect } = require('@playwright/test');

const ACCOUNTS = {
  student: { email: 'student@brainz.edu', password: 'Password123!' },
  teacher: { email: 'teacher@brainz.edu', password: 'Password123!' },
  director: { email: 'director@brainz.edu', password: 'Password123!' }
};

async function loginAs(page, role) {
  const creds = ACCOUNTS[role];
  await page.goto('/BrainzOS.html');
  await expect(page.locator('#login-viewport')).toBeVisible();

  await page.fill('#school-email', creds.email);
  await page.fill('#school-password', creds.password);
  await page.click('#continue-btn');

  await expect(page.locator('#app-viewport')).toHaveClass(/active-view/, { timeout: 10000 });
}

test.describe('Houses & 4-Terms Results System Verification', () => {
  test('Student Digital Pass displays NALANDA house (not Phoenix)', async ({ page }) => {
    await loginAs(page, 'student');

    // Navigate to Digital Pass
    await page.click('#nav-student-pass');
    await expect(page.locator('#page-student-pass')).toBeVisible();

    // Verify House is NALANDA
    const houseText = await page.locator('#pass-house-val').textContent();
    expect(houseText.trim().toUpperCase()).toBe('NALANDA');
    expect(houseText.trim().toUpperCase()).not.toContain('PHOENIX');
  });

  test('My Results page displays 4-term progress stepper or clean empty state without crashes', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await loginAs(page, 'student');

    // Navigate to My Results
    await page.click('#nav-student-results');
    await expect(page.locator('#page-student-results')).toBeVisible();

    // Wait for async fetch to finish loading
    await expect(page.locator('#student-results-loading')).toBeHidden({ timeout: 5000 });

    // Verify either results table or clean empty state is rendered without errors
    const emptyState = page.locator('#student-results-empty');
    const tableWrap = page.locator('#student-results-table-wrap');

    const hasResults = await tableWrap.isVisible();
    const hasEmpty = await emptyState.isVisible();

    expect(hasResults || hasEmpty).toBe(true);

    if (hasResults) {
      const tbodyText = await page.locator('#student-results-tbody').textContent();
      expect(tbodyText.length).toBeGreaterThan(0);
    } else {
      await expect(emptyState).toContainText('No results available yet');
    }

    // Assert zero console errors
    expect(consoleErrors).toEqual([]);
  });

  test('Teacher can select assessment term in Final Marks console', async ({ page }) => {
    await loginAs(page, 'teacher');

    // Navigate to Final Marks page
    await page.click('#nav-teacher-final-marks');
    await expect(page.locator('#page-teacher-final-marks')).toBeVisible();

    // Select term dropdown
    const termSelect = page.locator('#final-marks-term-select');
    await expect(termSelect).toBeVisible();
    await termSelect.selectOption('Unit Test - 1');

    // Verify max marks updated to 25
    await expect(page.locator('#final-marks-max-input')).toHaveValue('25');

    // Switch to Half Yearly
    await termSelect.selectOption('Half Yearly');
    await expect(page.locator('#final-marks-max-input')).toHaveValue('80');
  });
});
