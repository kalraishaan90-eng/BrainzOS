const fs = require('fs');
const content = fs.readFileSync('BrainzOS.html', 'utf8');

const aRegex = /<a\b([^>]*?)>(.*?)<\/a>/gis;
let m;
const links = [];
while ((m = aRegex.exec(content)) !== null) {
  links.push({
    attrs: m[1].replace(/\s+/g, ' ').trim(),
    text: m[2].replace(/<[^>]+>/g, '').trim(),
    pos: m.index
  });
}

console.log('Total <a> tags:', links.length);
links.forEach((l, i) => {
  console.log(`[${i+1}] attrs: ${l.attrs} | text: "${l.text}"`);
});
