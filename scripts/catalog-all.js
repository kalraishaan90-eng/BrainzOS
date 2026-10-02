const fs = require('fs');

const content = fs.readFileSync('BrainzOS.html', 'utf8');

// Find all HTML sections and their content
const sections = [];
const secRegex = /<(section|div)\b[^>]*?\bid=["']((?:page-|login-|cmd-|promo-|modal-|notice-|compliance-|support-|edit-|cookie-)[^"']*)["'][^>]*?>([\s\S]*?)<\/\1>/gi;

// We also want to examine the global header, sidebar, topbar
const headerMatch = content.match(/<header\b[^>]*?>([\s\S]*?)<\/header>/i);
const asideMatch = content.match(/<aside\b[^>]*?>([\s\S]*?)<\/aside>/i);
const footerMatch = content.match(/<footer\b[^>]*?>([\s\S]*?)<\/footer>/i);

console.log('Header found:', !!headerMatch);
console.log('Aside/Sidebar found:', !!asideMatch);
console.log('Footer found:', !!footerMatch);
