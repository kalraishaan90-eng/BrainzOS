const fs = require('fs');
const content = fs.readFileSync('BrainzOS.html', 'utf8');
const list = JSON.parse(fs.readFileSync('scripts/audited-inventory.json', 'utf8'));
const nonWorking = list.filter(x => x.status !== 'WORKING');

nonWorking.forEach((x, i) => {
  const snippet = content.substring(Math.max(0, x.pos - 80), Math.min(content.length, x.pos + 250));
  console.log(`========================================`);
  console.log(`ITEM ${i+1}: pos=${x.pos}, page=${x.page}, status=${x.status}, id=${x.id}, issue=${x.issue}`);
  console.log(snippet);
});
