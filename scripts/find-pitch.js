const fs = require('fs');
const content = fs.readFileSync('BrainzOS.html', 'utf8');

const lines = content.split('\n');
lines.forEach((l, i) => {
  if (/pitch/i.test(l)) {
    console.log(`Line ${i+1}: ${l.trim().slice(0, 120)}`);
  }
});
