const fs = require('fs');
const list = JSON.parse(fs.readFileSync('scripts/audited-inventory.json', 'utf8'));
const nonWorking = list.filter(x => x.status !== 'WORKING');
console.log('Total non-working static:', nonWorking.length);
nonWorking.forEach((x, i) => {
  console.log(`[${i+1}] Page: ${x.page} | Tag: <${x.tag}> | Label: "${x.label}" | ID: ${x.id || 'none'} | Status: ${x.status} | Issue: ${x.issue}`);
});
