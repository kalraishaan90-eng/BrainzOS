const fs = require('fs');
let content = fs.readFileSync('BrainzOS.html', 'utf8').replace(/\r\n/g, '\n');

// 2. Fix setDirectorPlannerToday boundary
const idx2 = content.indexOf('function setDirectorPlannerToday');
const target2 = content.slice(idx2 - 120, idx2);
const oldStr = "`).join('');\n  }";
const newStr = "`).join('');\n    }\n  }";

const fixed2 = target2.replace(oldStr, newStr);
if (target2 !== fixed2) {
  content = content.slice(0, idx2 - 120) + fixed2 + content.slice(idx2);
  console.log('Fixed 2 successfully');
} else {
  console.log('Failed to match 2');
}

fs.writeFileSync('BrainzOS.html', content, 'utf8');

// Test syntax
const scriptStart = content.lastIndexOf('<script', content.indexOf('function validateFormInputs'));
const scriptEnd = content.indexOf('</script>', scriptStart);
const scriptBody = content.slice(content.indexOf('>', scriptStart) + 1, scriptEnd);

try {
  new Function(scriptBody);
  console.log('Syntax Validation: SUCCESSFUL (No errors!)');
} catch (e) {
  console.error('Syntax error:', e.message);
}
