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
  console.log('Server started on', PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER LOG [' + msg.type() + ']:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));

  await page.goto(`http://127.0.0.1:${PORT}/BrainzOS.html`);
  console.log('Navigated to BrainzOS.html');

  // Quick select director
  await page.click('button[onclick="quickSelectRole(\'director\')"]');
  await page.click('#continue-btn');
  await page.waitForTimeout(4000);

  const authState = await page.evaluate(() => {
    return {
      currentUser: window.STATE?.currentUser,
      isPlaceholder: window.isPlaceholderSupabase,
      hasSession: !!window.STATE?.supabase?.auth?.getSession?.()
    };
  });
  console.log('Auth state:', JSON.stringify(authState, null, 2));

  const directorTabs = [
    { id: 'director-analytics', pageId: 'page-director-analytics' },
    { id: 'director-teacher-roster', pageId: 'page-director-teacher-roster' },
    { id: 'director-teachers', pageId: 'page-director-teachers' },
    { id: 'director-attendance-reports', pageId: 'page-director-attendance-reports' },
    { id: 'director-test-schedule', pageId: 'page-director-test-schedule' },
    { id: 'director-leave', pageId: 'page-director-leave' },
    { id: 'director-planner', pageId: 'page-director-planner' },
    { id: 'director-feed', pageId: 'page-director-feed' },
    { id: 'director-audit', pageId: 'page-director-audit' },
    { id: 'director-promotion', pageId: 'page-director-promotion' }
  ];

  for (const tab of directorTabs) {
    console.log('=== Checking tab:', tab.id, '===');
    const navBtn = page.locator('#nav-' + tab.id);
    const count = await navBtn.count();
    if (count === 0) {
      console.log('FAIL: Nav button not found: #nav-' + tab.id);
      continue;
    }
    await navBtn.click();
    await page.waitForTimeout(1000);
    const targetPage = page.locator('#' + tab.pageId);
    const isVisible = await targetPage.isVisible();
    const hasActiveClass = await targetPage.evaluate(el => el.classList.contains('active-page'));
    console.log(`Tab ${tab.id} -> ${tab.pageId}: visible=${isVisible}, activeClass=${hasActiveClass}`);
    
    // Check if there is any error overlay, blocked screen, or blocker message
    const blockerText = await page.evaluate((pageId) => {
      const el = document.getElementById(pageId);
      if (!el) return 'PAGE NOT IN DOM';
      const text = el.innerText || '';
      return {
        length: text.length,
        hasBlockedText: text.includes('Blocked') || text.includes('Access Denied') || text.includes('not previewable') || text.includes('403') || text.includes('unauthorized') || text.includes('Preview'),
        snippet: text.substring(0, 150)
      };
    }, tab.pageId);
    console.log(`Tab ${tab.id} content:`, JSON.stringify(blockerText));
  }

  await browser.close();
  server.close();
});
