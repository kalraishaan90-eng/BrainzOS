const fs = require('fs');

const content = fs.readFileSync('BrainzOS.html', 'utf8');

// Find all HTML elements that are interactive:
// 1. <button ...>...</button>
// 2. <a ...>...</a>
// 3. <input ...>
// 4. <select ...>...</select>
// 5. <textarea ...>...</textarea>
// 6. Any element with onclick="..."
// 7. Any element with role="button" or role="tab"

// Let's also parse the page/section boundaries so we know which page each element lives on.
// Let's collect all page sections.
const pageSectionRegex = /<section\b[^>]*?\bid=["'](page-[^"']+)["'][^>]*?>/gi;
const pages = [];
let sm;
while ((sm = pageSectionRegex.exec(content)) !== null) {
  pages.push({ id: sm[1], start: sm.index });
}

// Add login section / modals / global boundaries
const loginStart = content.indexOf('id="login-viewport"');
const appStart = content.indexOf('id="app-viewport"');
const scriptStart = content.indexOf('<script>');

function getPageForIndex(index) {
  if (index >= scriptStart) return 'JS_TEMPLATE';
  if (index < appStart) return 'login-viewport';
  
  // Check if inside a modal
  // Find which page section it falls into
  let currentPage = 'GLOBAL_SHELL';
  for (let i = 0; i < pages.length; i++) {
    if (index >= pages[i].start) {
      currentPage = pages[i].id;
    } else {
      break;
    }
  }
  // Check if it's after the last page section (modals at the end of body)
  const lastPage = pages[pages.length - 1];
  const lastPageEnd = content.indexOf('</section>', lastPage.start) + 10;
  if (index > lastPageEnd) {
    return 'MODAL_OR_GLOBAL';
  }
  return currentPage;
}

// Let's find all tags
const tagRegex = /<([a-zA-Z0-9]+)\b([^>]*?)>(?:([\s\S]*?)<\/\1>)?/gi;
const foundElements = [];

// To avoid duplicate matching or inner matches, let's scan specifically for interactive tags:
const interactiveTagRegex = /<(button|a|input|select|textarea)\b([^>]*?)(?:\/?>|>([\s\S]*?)<\/\1>)/gi;
let m;
while ((m = interactiveTagRegex.exec(content.substring(0, scriptStart))) !== null) {
  const tag = m[1];
  const attrs = m[2];
  const inner = m[3] || '';
  const pos = m.index;
  const page = getPageForIndex(pos);
  
  foundElements.push({
    tag,
    attrs,
    inner: inner.replace(/<[^>]+>/g, '').trim().slice(0, 50),
    page,
    pos
  });
}

// Also find elements with onclick that are not button/a/input/select/textarea
const onclickNonTagRegex = /<(div|span|li|tr|td|p|header|i)\b([^>]*?onclick=["'][^"']+["'][^>]*?)(?:\/?>|>([\s\S]*?)<\/\1>)/gi;
while ((m = onclickNonTagRegex.exec(content.substring(0, scriptStart))) !== null) {
  const tag = m[1];
  const attrs = m[2];
  const inner = m[3] || '';
  const pos = m.index;
  const page = getPageForIndex(pos);
  foundElements.push({
    tag,
    attrs,
    inner: inner.replace(/<[^>]+>/g, '').trim().slice(0, 50),
    page,
    pos
  });
}

console.log('Total static interactive elements found in HTML:', foundElements.length);
fs.writeFileSync('scripts/static-elements.json', JSON.stringify(foundElements, null, 2));
