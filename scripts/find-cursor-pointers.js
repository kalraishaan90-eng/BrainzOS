const fs = require('fs');
const content = fs.readFileSync('BrainzOS.html', 'utf8');

const regex = /<([a-zA-Z0-9]+)\b([^>]*?cursor\s*:\s*pointer[^>]*?)>(.*?)<\/\1>/gis;
let m;
let count = 0;
while ((m = regex.exec(content)) !== null) {
  count++;
  const tag = m[1];
  const attrs = m[2].replace(/\s+/g, ' ').trim();
  const text = m[3].replace(/<[^>]+>/g, '').trim();
  const hasOnclick = attrs.includes('onclick');
  const hasId = attrs.includes('id=');
  console.log(`[${count}] <${tag}> text="${text}" | onclick=${hasOnclick} | id=${hasId} | attrs=${attrs.slice(0, 100)}`);
}
console.log('Total cursor:pointer elements:', count);
