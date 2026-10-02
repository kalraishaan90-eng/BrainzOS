const fs = require('fs');

const content = fs.readFileSync('BrainzOS.html', 'utf8');

// Let's inspect toggleAuthMode, support ticket, pitch pad, compliance, etc.
const toInspect = [
  'toggleAuthMode',
  'submitSupportTicket',
  'dismissCookieBanner',
  'fetchPitchPadVentures',
  'togglePitchVote',
  'toggleDirectorsPick',
  'exportExecutiveSummary',
  'exportTeacherDossier',
  'openComplianceModal',
  'openSupportModal',
  'notif-bell',
  'user-menu',
  'theme-toggle',
  'privacy',
  'terms',
  'help'
];

toInspect.forEach(name => {
  console.log(`=== SEARCH: ${name} ===`);
  const regex = new RegExp(`(?:function\\s+${name}|id=["'][^"']*${name}[^"']*["']|onclick=["'][^"']*${name}[^"']*["']|href=["'][^"']*${name}[^"']*["'])`, 'gi');
  let m;
  let count = 0;
  while ((m = regex.exec(content)) !== null) {
    count++;
    const snippet = content.substring(Math.max(0, m.index - 50), Math.min(content.length, m.index + 200));
    console.log(`[${count}] at char ${m.index}:\n${snippet}\n---`);
  }
  if (count === 0) console.log('NONE FOUND');
});
