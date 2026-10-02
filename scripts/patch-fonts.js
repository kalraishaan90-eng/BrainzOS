const fs = require('fs');
let html = fs.readFileSync('BrainzOS.html', 'utf8');
const oldSnippet = html.match(/<!-- Typography: Newsreader[\s\S]*?<!-- Lucide Icon/);
if (oldSnippet) {
  html = html.replace(oldSnippet[0], `<!-- Typography: Newsreader & Plus Jakarta Sans (Self-Hosted On-Premises) -->
  <link rel="stylesheet" href="vendor/fonts.css" />

  <!-- Lucide Icon`);
  fs.writeFileSync('BrainzOS.html', html, 'utf8');
  console.log('Successfully replaced fonts with vendor/fonts.css');
} else {
  console.log('Pattern not matched');
}
