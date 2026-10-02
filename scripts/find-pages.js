const fs = require('fs');
const content = fs.readFileSync('BrainzOS.html', 'utf8');

// Find all page sections
const pageRegex = /id=["'](page-[^"']+)["']/g;
const pages = new Set();
let m;
while ((m = pageRegex.exec(content)) !== null) {
  pages.add(m[1]);
}
console.log('Pages found:', pages.size);
console.log([...pages].sort().join('\n'));
