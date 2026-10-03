const fs = require('fs');

const html = fs.readFileSync('BrainzOS.html', 'utf8');

// Let's find all <button, <a, <input, <select, <textarea, and elements with onclick or role="button"
const elementRegex = /<([a-zA-Z0-9]+)\b([^>]*?)>(?:([\s\S]*?)<\/\1>)?/gi;

// Also let's find all page boundaries to know which page an element belongs to
// Find all id="page-..." positions
const pagePositions = [];
const pageRegex = /<section\b[^>]*?\bid=["'](page-[^"']+)["'][^>]*?>/gi;
let pm;
while ((pm = pageRegex.exec(html)) !== null) {
  pagePositions.push({
    id: pm[1],
    index: pm.index
  });
}

// Global shell is anything outside page sections (or in sidebar, topbar, modals)
console.log('Found page sections in order:');
pagePositions.forEach(p => console.log('  ', p.id, '@ char', p.index));

// Also let's find modals
const modalRegex = /<div\b[^>]*?\bid=["']([^"']*(?:modal|overlay|drawer|dialog)[^"']*)["'][^>]*?>/gi;
const modals = [];
while ((pm = modalRegex.exec(html)) !== null) {
  modals.push({ id: pm[1], index: pm.index });
}
console.log('Found modal/overlay containers:');
modals.forEach(m => console.log('  ', m.id, '@ char', m.index));
