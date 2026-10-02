const fs = require('fs');

const content = fs.readFileSync('BrainzOS.html', 'utf8');
const scriptStart = content.indexOf('<script>');
const jsPart = content.slice(scriptStart);

// Find template literals containing HTML tags
const templateRegex = /`([\s\S]*?)`/g;
let tm;
const dynamicElements = [];
while ((tm = templateRegex.exec(jsPart)) !== null) {
  const tpl = tm[1];
  if (!tpl.includes('<')) continue;
  
  const tagRegex = /<(button|a|input|select|textarea|div|span)\b([^>]*?)(?:\/?>|>([\s\S]*?)<\/\1>)/gi;
  let em;
  while ((em = tagRegex.exec(tpl)) !== null) {
    const tag = em[1];
    const attrs = em[2];
    const inner = (em[3] || '').replace(/<[^>]+>/g, '').trim().slice(0, 50);
    // Only keep if button, a, input, select, textarea, or has onclick or role="button"
    if (['button', 'a', 'input', 'select', 'textarea'].includes(tag.toLowerCase()) || /onclick=|role=["']button["']/.test(attrs)) {
      dynamicElements.push({
        tag,
        attrs: attrs.replace(/\s+/g, ' ').trim(),
        inner,
        context: tpl.slice(0, 80).replace(/\s+/g, ' ').trim()
      });
    }
  }
}

console.log('Total dynamic template elements found in JS:', dynamicElements.length);
fs.writeFileSync('scripts/dynamic-elements.json', JSON.stringify(dynamicElements, null, 2));
