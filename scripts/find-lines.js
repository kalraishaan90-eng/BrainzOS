const fs = require('fs');
const content = fs.readFileSync('BrainzOS.html', 'utf8');
const lines = content.split('\n');

function findPattern(query, desc) {
  console.log(`\n=== ${desc} (${query}) ===`);
  lines.forEach((line, i) => {
    if (line.includes(query)) {
      console.log(`Line ${i+1}: ${line.trim()}`);
    }
  });
}

findPattern('biometric-btn', 'Item 1');
findPattern('exportGradebookCSV', 'Item 2');
findPattern('publish-broadcast-btn', 'Item 7');
findPattern('exportExecutiveSummary', 'Item 11');
findPattern('exportAuditLogsCSV', 'Item 12');
findPattern('exportTeacherDossier', 'Item 13');
findPattern('btn-upload-student-doc', 'Item 15');
findPattern('submitSupportTicket', 'Item 18');
