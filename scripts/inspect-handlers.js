const fs = require('fs');
const html = fs.readFileSync('BrainzOS.html', 'utf8');

const scriptStart = html.indexOf('<script>');
const jsPart = html.substring(scriptStart);

// Look for onclick in HTML
const onclickMatches = html.match(/onclick=["'][^"']+["']/g);
console.log('Total onclick attributes in HTML:', onclickMatches ? onclickMatches.length : 0);

// Look for addEventListener in JS
const allAddEvent = jsPart.match(/\.addEventListener\s*\([^)]+\)/g);
console.log('Total addEventListener in JS:', allAddEvent ? allAddEvent.length : 0);
if (allAddEvent) {
  console.log('Sample addEventListener:', allAddEvent.slice(0, 10));
}

// Look for window.* = function or global handlers
const globalFuncs = jsPart.match(/function\s+([a-zA-Z0-9_]+)\s*\(/g);
console.log('Total declared functions:', globalFuncs ? globalFuncs.length : 0);
