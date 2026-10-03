const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:3000/BrainzOS.html...');
  await page.goto('http://127.0.0.1:3000/BrainzOS.html');

  // Fill director credentials
  await page.fill('#school-email', 'director@brainz.edu');
  await page.fill('#school-password', 'Director2026!');
  await page.click('button[type="submit"]');

  // Wait for director dashboard
  await page.waitForSelector('#sidebar-user-badge', { timeout: 8000 });
  console.log('Director logged in successfully');

  // Navigate to School-Wide Feed
  console.log('Navigating to School-Wide Feed...');
  await page.click('button[data-page-id="page-director-feed"]');
  await page.waitForTimeout(1000);

  // Navigate to Audit Logs
  console.log('Navigating to Audit Logs...');
  await page.click('button[data-page-id="page-director-audit"]');
  await page.waitForTimeout(1500);

  // Check audit table rows
  const rowCount = await page.locator('#audit-logs-table-body tr').count();
  console.log(`Audit log row count: ${rowCount}`);

  const sampleRowText = await page.locator('#audit-logs-table-body tr').first().innerText();
  console.log(`First row: ${sampleRowText.replace(/\n+/g, ' | ')}`);

  // Check layout dimensions
  const layout = await page.evaluate(() => {
    const canvas = document.querySelector('.content-canvas');
    const sidebar = document.querySelector('.app-sidebar');
    const table = document.querySelector('#page-director-audit table');
    return {
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      canvasWidth: canvas ? canvas.offsetWidth : null,
      sidebarWidth: sidebar ? sidebar.offsetWidth : null,
      tableWidth: table ? table.offsetWidth : null,
      hasHorizontalOverflow: document.body.scrollWidth > document.body.clientWidth
    };
  });
  console.log('Layout check:', JSON.stringify(layout, null, 2));

  // Take screenshot
  await page.screenshot({ path: 'test-results/audit-fixed.png' });
  console.log('Saved screenshot to test-results/audit-fixed.png');

  await browser.close();
})();
