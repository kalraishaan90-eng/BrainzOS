const fs = require('fs');
const content = fs.readFileSync('BrainzOS.html', 'utf8');

const regex = /\.innerHTML\s*=\s*/g;
let m;
const matches = [];
while ((m = regex.exec(content)) !== null) {
  const lineNum = content.slice(0, m.index).split('\n').length;
  const line = content.split('\n')[lineNum - 1].trim();
  matches.push({ lineNum, line });
}

console.log('Total innerHTML assignments:', matches.length);
matches.forEach(m => console.log(`Line ${m.lineNum}: ${m.line.slice(0, 100)}`));
