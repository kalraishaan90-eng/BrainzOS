const { test, expect } = require('@playwright/test');

test.describe('Director Role Full Tab Render & Navigation Verification', () => {
  test('Director logs in and visits EVERY director tab without being blocked or redirected', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/BrainzOS.html');
    await expect(page.locator('#login-viewport')).toBeVisible();
    await page.fill('#school-email', 'director@brainz.edu');
    await page.fill('#school-password', 'Password123!');
    await page.click('#continue-btn');
    await expect(page.locator('#app-viewport')).toHaveClass(/active-view/, { timeout: 10000 });

    const directorTabs = [
      { id: 'director-analytics', pageId: 'page-director-analytics', title: 'Executive Analytics' },
      { id: 'director-teacher-roster', pageId: 'page-director-teacher-roster', title: 'Teachers' },
      { id: 'director-teachers', pageId: 'page-director-teachers', title: 'Faculty Roster & Account Provisioning' },
      { id: 'director-attendance-reports', pageId: 'page-director-attendance-reports', title: 'Institutional Attendance Reports' },
      { id: 'director-test-schedule', pageId: 'page-director-test-schedule', title: 'Master Test Schedule' },
      { id: 'director-leave', pageId: 'page-director-leave', title: 'Staff Leave & Substitutions' },
      { id: 'director-planner', pageId: 'page-director-planner', title: 'Curriculum Delivery & Test Rollup' },
      { id: 'director-feed', pageId: 'page-director-feed', title: 'School-Wide Feed' },
      { id: 'director-audit', pageId: 'page-director-audit', title: 'Audit Logs' },
      { id: 'director-promotion', pageId: 'page-director-promotion', title: 'Year-End Promotion' }
    ];

    for (const tab of directorTabs) {
      const navBtn = page.locator('#nav-' + tab.id);
      await expect(navBtn).toBeVisible();
      await navBtn.click();
      
      // Ensure page becomes active and visible
      const pageEl = page.locator('#' + tab.pageId);
      await expect(pageEl).toBeVisible();
      await expect(pageEl).toHaveClass(/active-page/);

      // Verify no kickout to student dashboard
      await expect(page.locator('#page-student-dashboard')).not.toHaveClass(/active-page/);

      // Verify the page has header content
      const content = await pageEl.innerText();
      expect(content.length).toBeGreaterThan(50);
      expect(content).not.toContain('Module Not Found in Directory');
      expect(content).not.toContain('Access Denied');
    }

    // Zero console errors
    expect(consoleErrors).toEqual([]);
  });
});
