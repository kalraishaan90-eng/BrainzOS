const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('BrainzOS.html', 'utf8');

// Separate HTML markup from script
const scriptStart = html.indexOf('<script>');
const htmlPart = scriptStart !== -1 ? html.substring(0, scriptStart) : html;
const jsPart = scriptStart !== -1 ? html.substring(scriptStart) : '';

console.log('HTML length:', htmlPart.length, 'JS length:', jsPart.length);

// Extract all IDs in HTML
const idRegex = /id=["']([^"']+)["']/g;
const ids = new Set();
let m;
while ((m = idRegex.exec(htmlPart)) !== null) {
  ids.add(m[1]);
}
console.log('Total static IDs in HTML:', ids.size);

// Extract elements by tag or attribute
// Let's find buttons, links, inputs, selects, textareas, elements with onclick
const tagRegex = /<([a-z0-9]+)\b([^>]*?)(\/?>|>(.*?)<\/\1>)/gis;

// Find all addEventListener in JS
const listenerRegex = /(?:document\.getElementById\(['"]([^'"]+)['"]\)|document\.querySelector\(['"]#([^'"]+)['"]\))\s*\.\s*addEventListener\(\s*['"]([a-zA-Z0-9]+)['"]/g;
const listeners = new Map();
while ((m = listenerRegex.exec(jsPart)) !== null) {
  const id = m[1] || m[2];
  const evt = m[3];
  if (!listeners.has(id)) listeners.set(id, []);
  listeners.get(id).push(evt);
}
console.log('Total element IDs with addEventListener:', listeners.size);

// Find delegation listeners or $(...).on or document.addEventListener
const docListeners = [];
const docLRegex = /document\.addEventListener\(\s*['"]([a-zA-Z0-9]+)['"]/g;
while ((m = docLRegex.exec(jsPart)) !== null) {
  docListeners.push(m[1]);
}
console.log('Document listeners:', docListeners);

// Output summary
