const fs = require('fs');
const content = fs.readFileSync('BrainzOS.html', 'utf8');

// Find top-level views/containers
const viewMatches = content.match(/id=["'](view-[^"']+|auth-[^"']+|login-[^"']+)["']/g);
console.log('Views/auth containers:', viewMatches);

// Find navigation setup
const navMatch = content.match(/function\s+navigateTo\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
if (navMatch) {
  console.log('navigateTo snippet:');
  console.log(navMatch[0].slice(0, 1500));
}
