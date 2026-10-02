const fs = require('fs');
const content = fs.readFileSync('BrainzOS.html', 'utf8');

// Find all buttons in modals (between char 298000 and 326000)
const modalsPart = content.substring(298000, 326000);
const btnRegex = /<button\b([^>]*?)>(.*?)<\/button>/gis;
let m;
while ((m = btnRegex.exec(modalsPart)) !== null) {
  console.log('--- MODAL BUTTON ---');
  console.log('Attrs:', m[1].replace(/\s+/g, ' ').trim());
  console.log('Text:', m[2].replace(/<[^>]+>/g, '').trim());
}
