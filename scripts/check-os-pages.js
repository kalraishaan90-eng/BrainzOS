const fs = require('fs');
const content = fs.readFileSync('BrainzOS.html', 'utf8');

const regex = /<([a-zA-Z0-9]+)[^>]*class=["'][^"']*os-page[^"']*["'][^>]*id=["']([^"']+)["']/g;
let match;
while ((match = regex.exec(content)) !== null) {
  console.log('Tag:', match[1], 'ID:', match[2]);
}
