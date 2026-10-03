const fs = require('fs');

const content = fs.readFileSync('BrainzOS.html', 'utf8');

// Check all href attributes
const hrefRegex = /href=["']([^"']+)["']/g;
let m;
console.log('--- ALL HREF VALUES ---');
while ((m = hrefRegex.exec(content)) !== null) {
  const val = m[1];
  if (!val.startsWith('http') && !val.startsWith('data:') && !val.startsWith('mailto:')) {
    console.log('href:', val);
  }
}

// Check all buttons with no onclick and no type=submit
const btnRegex = /<button\b([^>]*?)>(.*?)<\/button>/gis;
console.log('\n--- BUTTONS WITHOUT ONCLICK ---');
let bCount = 0;
while ((m = btnRegex.exec(content)) !== null) {
  const attrs = m[1];
  const text = m[2].replace(/<[^>]+>/g, '').trim();
  if (!attrs.includes('onclick')) {
    bCount++;
    console.log(`[${bCount}] Attrs: ${attrs.replace(/\s+/g, ' ').trim()} | Text: "${text}"`);
  }
}
