const fs = require('fs');

const backup = fs.readFileSync('brainzos-PRE-QA-BACKUP.html', 'utf8');
const backupLines = backup.split('\n');
const loginChunk = backupLines.slice(8647, 8956).join('\n');

let current = fs.readFileSync('BrainzOS.html', 'utf8');
const target = '/* Biometric Login removed in compliance with no-dead-controls audit */';

if (current.includes(target)) {
  current = current.replace(target, loginChunk + '\n\n' + target);
  fs.writeFileSync('BrainzOS.html', current, 'utf8');
  console.log('Successfully restored login handlers!');
} else {
  console.error('Target not found in BrainzOS.html');
}
