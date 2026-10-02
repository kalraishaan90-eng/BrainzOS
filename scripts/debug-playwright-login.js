const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Start temporary server
const PORT = 8089;
const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/BrainzOS.html';
  const filePath = path.join(__dirname, '..', reqPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const ext = path.extname(filePath);
  const type = ext === '.html' ? 'text/html' : (ext === '.js' ? 'application/javascript' : 'text/plain');
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '127.0.0.1', async () => {
  console.log('Testing browser on port', PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));

  await page.goto(`http://127.0.0.1:${PORT}/BrainzOS.html`);
  console.log('Page loaded');

  // Check Supabase object in browser
  const sbStatus = await page.evaluate(() => {
    return {
      hasSupabaseLib: typeof window.supabase !== 'undefined',
      hasSupabaseInstance: typeof supabase !== 'undefined' && supabase !== null,
      isPlaceholder: typeof isPlaceholderSupabase !== 'undefined' ? isPlaceholderSupabase : null,
      configUrl: typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.url : null
    };
  });
  console.log('Supabase status in browser:', sbStatus);

  // Fill credentials and click continue
  await page.click('button[onclick="quickSelectRole(\'student\')"]');
  console.log('Clicked quickSelectRole student');

  const btnDisabled = await page.locator('#continue-btn').isDisabled();
  console.log('Continue button disabled?', btnDisabled);

  await page.click('#continue-btn');
  console.log('Clicked continue btn');

  await page.waitForTimeout(4000);
  const classes = await page.locator('#app-viewport').getAttribute('class');
  console.log('#app-viewport class:', classes);

  const errorText = await page.locator('#login-email-error-text').textContent().catch(() => '');
  console.log('Login error text:', errorText);

  await browser.close();
  server.close();
});
