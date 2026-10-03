const fs = require('fs');
const html = fs.readFileSync('BrainzOS.html', 'utf8');

const scriptStart = html.indexOf('<script>');
const htmlPart = html.substring(0, scriptStart);
const jsPart = html.substring(scriptStart);

const htmlOnclicks = htmlPart.match(/onclick=["'][^"']+["']/g) || [];
const jsOnclicks = jsPart.match(/onclick=["'][^"']+["']/g) || [];

console.log('HTML onclicks:', htmlOnclicks.length);
console.log('JS template onclicks:', jsOnclicks.length);
console.log('Total onclicks:', htmlOnclicks.length + jsOnclicks.length);
