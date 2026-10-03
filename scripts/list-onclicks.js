const fs = require('fs');

const content = fs.readFileSync('BrainzOS.html', 'utf8');

// Find all occurrences of onclick="..."
const onclickRegex = /onclick=["']([^"']+)["']/g;
let m;
const onclicks = new Set();
while ((m = onclickRegex.exec(content)) !== null) {
  onclicks.add(m[1].trim());
}

console.log('Total unique onclicks:', onclicks.size);
[...onclicks].sort().forEach(oc => {
  console.log('  ', oc);
});
