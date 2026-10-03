const { test, expect } = require('@playwright/test');

const ACCOUNTS = {
  student: { email: 'student@brainz.edu', password: 'Password123!', roleLabel: 'Class' },
  teacher: { email: 'teacher@brainz.edu', password: 'Password123!', roleLabel: 'Faculty' },
  director: { email: 'director@brainz.edu', password: 'Password123!', roleLabel: 'Executive' }
};

test.describe('BrainzOS Auth Smoke Test', () => {
  for (const [role, creds] of Object.entries(ACCOUNTS)) {
    test(`Login as ${role}`, async ({ page }) => {
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto('/BrainzOS.html');
      await expect(page.locator('#login-viewport')).toBeVisible();

      await page.fill('#school-email', creds.email);
      await page.fill('#school-password', creds.password);
      await page.click('#continue-btn');

      // Expect transition to app-viewport
      await expect(page.locator('#app-viewport')).toHaveClass(/active-view/, { timeout: 10000 });

      // Verify role indicator or topbar
      const roleText = await page.locator('#topbar-user-role').textContent();
      expect(roleText).toContain(creds.roleLabel);

      // Verify no console errors
      expect(consoleErrors).toEqual([]);
    });
  }
});
