const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 8089;
const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/BrainzOS.html';
  const filePath = path.join(process.cwd(), reqPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const ext = path.extname(filePath);
  const type = ext === '.html' ? 'text/html' : (ext === '.js' ? 'application/javascript' : (ext === '.css' ? 'text/css' : 'text/plain'));
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '127.0.0.1', async () => {
  console.log('Server running on port', PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER CONSOLE ERROR:', msg.text());
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
    errors.push(err.message);
  });

  await page.goto(`http://127.0.0.1:${PORT}/BrainzOS.html`);
  await page.click('button[onclick="quickSelectRole(\'director\')"]');
  await page.click('#continue-btn');
  await page.waitForTimeout(3000);

  const tabs = [
    { name: 'Executive Analytics', nav: '#nav-director-analytics', page: '#page-director-analytics' },
    { name: 'Teachers Roster', nav: '#nav-director-teacher-roster', page: '#page-director-teacher-roster' },
    { name: 'Faculty Management', nav: '#nav-director-teachers', page: '#page-director-teachers' },
    { name: 'Attendance Reports', nav: '#nav-director-attendance-reports', page: '#page-director-attendance-reports' },
    { name: 'Master Test Schedule', nav: '#nav-director-test-schedule', page: '#page-director-test-schedule' },
    { name: 'Staff Leave & Substitutions', nav: '#nav-director-leave', page: '#page-director-leave' },
    { name: 'Curriculum & Test Rollup', nav: '#nav-director-planner', page: '#page-director-planner' },
    { name: 'School-Wide Feed', nav: '#nav-director-feed', page: '#page-director-feed' },
    { name: 'Audit Logs', nav: '#nav-director-audit', page: '#page-director-audit' },
    { name: 'Year-End Promotion', nav: '#nav-director-promotion', page: '#page-director-promotion' }
  ];

  for (const t of tabs) {
    console.log(`\nTesting tab: ${t.name}`);
    await page.click(t.nav);
    await page.waitForTimeout(1000);
    const isVisible = await page.locator(t.page).isVisible();
    console.log(`Tab ${t.name} visible: ${isVisible}`);
    
    // Check if URL hash updated
    const hash = await page.evaluate(() => window.location.hash);
    console.log(`URL Hash: ${hash}`);

    // Check if blocked or error
    const pageHtml = await page.locator(t.page).innerHTML();
    if (pageHtml.length < 50) {
      console.log(`WARNING: tab ${t.name} seems empty! Length: ${pageHtml.length}`);
    }
  }

  // Also test Teacher Detail page (navigated via teacher click)
  console.log('\nTesting Teacher Detail view...');
  await page.click('#nav-director-teacher-roster');
  await page.waitForTimeout(500);
  const teacherCard = page.locator('.teacher-roster-card, [onclick*="openTeacherDetail"]').first();
  if (await teacherCard.count() > 0) {
    await teacherCard.click();
    await page.waitForTimeout(1000);
    const detailVisible = await page.locator('#page-director-teacher-detail').isVisible();
    console.log(`Teacher Detail page visible: ${detailVisible}`);
  }

  // Test Year-End Promotion Run Preview button
  console.log('\nTesting Promotion Run Preview button...');
  await page.click('#nav-director-promotion');
  await page.waitForTimeout(500);
  const previewBtn = page.locator('#promo-preview-btn');
  if (await previewBtn.count() > 0) {
    await previewBtn.click();
    await page.waitForTimeout(2000);
    const previewSummary = await page.locator('#promo-preview-summary').isVisible();
    const previewTable = await page.locator('#promo-preview-table-wrap').isVisible();
    console.log(`Promo preview triggered: summaryVisible=${previewSummary}, tableVisible=${previewTable}`);
  }

  console.log('\nTotal console/page errors encountered:', errors.length);
  if (errors.length > 0) {
    console.log('Errors:', errors);
  }

  await browser.close();
  server.close();
  process.exit(errors.length > 0 ? 1 : 0);
});
