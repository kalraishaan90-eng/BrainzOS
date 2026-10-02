const fs = require('fs');
const path = require('path');
const https = require('https');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, url).href;
        return downloadFile(nextUrl, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: status code ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed ${url}: status ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  const vendorDir = path.join(__dirname, '..', 'vendor');
  const fontsDir = path.join(vendorDir, 'fonts');
  if (!fs.existsSync(vendorDir)) fs.mkdirSync(vendorDir, { recursive: true });
  if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });

  console.log('1. Downloading Lucide icons...');
  await downloadFile('https://unpkg.com/lucide@latest/dist/umd/lucide.min.js', path.join(vendorDir, 'lucide.min.js'));
  console.log('Downloaded lucide.min.js');

  console.log('2. Downloading Supabase JS client...');
  await downloadFile('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js', path.join(vendorDir, 'supabase.min.js'));
  console.log('Downloaded supabase.min.js');

  console.log('3. Downloading Google Fonts CSS...');
  const fontCssUrl = 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
  const css = await fetchText(fontCssUrl);

  // Parse font URLs from CSS and download each font file
  const fontUrlRegex = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
  let match;
  const urls = [];
  while ((match = fontUrlRegex.exec(css)) !== null) {
    urls.push(match[1]);
  }
  console.log(`Found ${urls.length} font files to vendor.`);

  let localCss = css;
  let counter = 0;
  for (const url of urls) {
    const ext = path.extname(url.split('?')[0]) || '.woff2';
    const filename = `font-${++counter}${ext}`;
    const dest = path.join(fontsDir, filename);
    await downloadFile(url, dest);
    console.log(`Downloaded ${filename}`);
    // Replace URL in CSS with relative local path
    localCss = localCss.split(url).join(`fonts/${filename}`);
  }

  fs.writeFileSync(path.join(vendorDir, 'fonts.css'), localCss, 'utf8');
  console.log('Saved vendor/fonts.css');
  console.log('All vendor assets downloaded successfully!');
}

main().catch(err => {
  console.error('Error vendoring assets:', err);
  process.exit(1);
});
