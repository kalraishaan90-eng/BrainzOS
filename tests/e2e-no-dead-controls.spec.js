const { test, expect } = require('@playwright/test');

// Test accounts seeded in Supabase
const ACCOUNTS = {
  student: { email: 'student@brainz.edu', password: 'Password123!', roleName: 'student' },
  teacher: { email: 'teacher@brainz.edu', password: 'Password123!', roleName: 'teacher' },
  director: { email: 'director@brainz.edu', password: 'Password123!', roleName: 'director' }
};

// Helper: login as role
async function loginAs(page, role) {
  const creds = ACCOUNTS[role];
  await page.goto('/BrainzOS.html');
  await expect(page.locator('#login-viewport')).toBeVisible();

  await page.fill('#school-email', creds.email);
  await page.fill('#school-password', creds.password);
  await page.click('#continue-btn');

  await expect(page.locator('#app-viewport')).toHaveClass(/active-view/, { timeout: 10000 });
}

test.describe('External Domain Isolation Test', () => {
  test('Assert no unauthorized external requests occur during session', async ({ page }) => {
    const unauthorizedRequests = [];
    const allowedHosts = [
      'localhost',
      '127.0.0.1'
    ];

    page.on('request', req => {
      const url = new URL(req.url());
      if (!allowedHosts.some(host => url.hostname.endsWith(host))) {
        unauthorizedRequests.push(req.url());
      }
    });

    await loginAs(page, 'student');
    await page.waitForTimeout(1000);
    expect(unauthorizedRequests).toEqual([]);
  });
});

test.describe('Student Role End-to-End Controls', () => {
  test('Student visits all pages and exercises controls with zero dead elements', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await loginAs(page, 'student');

    // 1. Dashboard quick links
    await expect(page.locator('#page-student-dashboard')).toBeVisible();
    await page.click('button:has-text("Digital Pass")');
    await expect(page.locator('#page-student-pass')).toBeVisible();

    // 2. Digital Pass flip card
    await page.click('button:has-text("Flip Digital Pass")');
    await page.waitForTimeout(400);
    await page.locator('#pass-card-element').click();

    // 3. Timetable navigation
    await page.click('#nav-student-timetable');
    await expect(page.locator('#page-student-timetable')).toBeVisible();

    // 4. Assignments & Filters
    await page.click('#nav-student-assignments');
    await expect(page.locator('#page-student-assignments')).toBeVisible();
    await page.click('#asg-filter-pending');
    await page.click('#asg-filter-completed');
    await page.click('#asg-filter-all');
    await page.fill('#asg-search-input', 'Market');
    await page.fill('#asg-search-input', '');

    // 5. Clubs & Houses
    await page.click('#nav-student-clubs');
    await expect(page.locator('#page-student-clubs')).toBeVisible();
    await expect(page.locator('text=Lab Schedule').first()).toBeVisible();

    // 6. Results
    await page.click('#nav-student-results');
    await expect(page.locator('#page-student-results')).toBeVisible();

    // 7. Command palette
    await page.click('.search-trigger');
    await expect(page.locator('#cmd-overlay')).toHaveClass(/active/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#cmd-overlay')).not.toHaveClass(/active/);

    // Verify no unhandled console errors
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Teacher Role End-to-End Controls', () => {
  test('Teacher visits pages, exercises coursework filters and exports gradebook CSV', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await loginAs(page, 'teacher');
    await expect(page.locator('#page-teacher-overview')).toBeVisible();

    // 1. Class Assignments & Cohort Filters
    await page.click('#nav-teacher-assignments');
    await expect(page.locator('#page-teacher-assignments')).toBeVisible();

    // Click cohort filter pills
    await page.click('#teacher-asg-filter-xib');
    await page.click('#teacher-asg-filter-xia');
    await page.click('#teacher-asg-filter-pending');
    await page.click('#teacher-asg-filter-all');

    // Open & Close new assignment modal
    await page.click('button:has-text("+ New Assignment")');
    await expect(page.locator('#new-assignment-modal')).toHaveClass(/active/);
    await page.click('#new-assignment-modal button:has-text("Cancel")');
    await expect(page.locator('#new-assignment-modal')).not.toHaveClass(/active/);

    // 2. Gradebook & CSV Export
    await page.click('#nav-teacher-gradebook');
    await expect(page.locator('#page-teacher-gradebook')).toBeVisible();

    // Trigger CSV export and assert download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button[onclick="exportGradebookCSV()"]')
    ]);
    expect(download.suggestedFilename()).toContain('.csv');

    // 3. Faculty Leave Requests
    await page.click('#nav-teacher-leave');
    await expect(page.locator('#page-teacher-leave')).toBeVisible();
    await page.click('#page-teacher-leave button:has-text("Refresh")');

    // Verify clean console
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Director Role End-to-End Controls', () => {
  test('Director visits consoles, exports executive summary and audit ledger CSV', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await loginAs(page, 'director');
    await expect(page.locator('#page-director-analytics')).toBeVisible();

    // 1. Executive Analytics & Report Download
    await page.click('button[onclick="refreshAnalyticsMetrics()"]');
    const [reportDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button[onclick="exportExecutiveSummary()"]')
    ]);
    expect(reportDownload.suggestedFilename()).toContain('.csv');

    // 2. Audit Ledger & CSV Export
    await page.click('#nav-director-audit');
    await expect(page.locator('#page-director-audit')).toBeVisible();
    await page.fill('#audit-filter-input', 'Security');
    await page.fill('#audit-filter-input', '');

    const [auditDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button[onclick="exportAuditLogsCSV()"]')
    ]);
    expect(auditDownload.suggestedFilename()).toContain('.csv');

    // 3. School-wide feed notice modal
    await page.click('#nav-director-feed');
    await expect(page.locator('#page-director-feed')).toBeVisible();
    await page.click('button[onclick="openNewNoticeModal()"]');
    await expect(page.locator('#notice-modal-overlay')).toHaveClass(/active/);
    await page.click('#notice-modal-overlay button:has-text("Cancel")');
    await expect(page.locator('#notice-modal-overlay')).not.toHaveClass(/active/);

    // Verify clean console
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Dead Control Detector Test', () => {
  test('Generic detector asserts all visible buttons trigger observable action', async ({ page }) => {
    await loginAs(page, 'student');

    // Allow-list for controls with explicit written reason:
    // 1. dismissCookieBanner: banner dismissed on first click or already dismissed
    // 2. toggleSelectAllAssignees: sub-control in closed modals
    const ALLOWLIST = [
      'dismissCookieBanner',
      'toggleSelectAllAssignees'
    ];

    // Collect all visible buttons in the current active page
    const buttons = await page.$$eval('#page-student-dashboard button:visible', btns =>
      btns.map(b => ({
        id: b.id,
        text: (b.innerText || '').trim(),
        onclick: b.getAttribute('onclick') || ''
      }))
    );

    for (const b of buttons) {
      if (ALLOWLIST.some(a => b.onclick.includes(a))) continue;

      // Set up DOM mutation observer
      await page.evaluate(() => {
        window.__mutated = false;
        const observer = new MutationObserver(() => { window.__mutated = true; });
        observer.observe(document.body, { attributes: true, childList: true, subtree: true });
        window.__mutationObserver = observer;
      });

      // Target by onclick or text
      let target;
      if (b.id) target = `#${b.id}`;
      else if (b.onclick) target = `button[onclick="${b.onclick}"]`;
      else target = `button:has-text("${b.text}")`;

      await page.click(target).catch(() => {});
      await page.waitForTimeout(400);

      const mutated = await page.evaluate(() => {
        if (window.__mutationObserver) window.__mutationObserver.disconnect();
        return window.__mutated;
      });

      expect(mutated).toBe(true);

      // Return to student dashboard if navigation occurred
      await page.evaluate(() => {
        if (typeof navigateTo === 'function') navigateTo('page-student-dashboard', true);
      });
      await page.waitForTimeout(300);
    }
  });
});
