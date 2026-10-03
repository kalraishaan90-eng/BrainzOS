const fs = require('fs');

let html = fs.readFileSync('BrainzOS.html', 'utf8').replace(/\r\n/g, '\n');

const target = 'type="submit" aria-label="Confirm and publish assignment"';
const replacement = 'id="new-assign-submit-btn" type="submit" aria-label="Confirm and publish assignment"';

if (html.includes(target)) {
  html = html.replace(target, replacement);
  fs.writeFileSync('BrainzOS.html', html, 'utf8');
  console.log('Button ID added successfully.');
} else {
  console.log('Target not found or already replaced.');
}
