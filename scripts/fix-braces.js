const fs = require('fs');
let content = fs.readFileSync('BrainzOS.html', 'utf8').replace(/\r\n/g, '\n');

// 1. Fix fetchDirectorLeaveOverview:
const oldLeaveEnd = `: '<span class="subtext" style="font-size: 11px;">Request Closed</span>')}\n          </td>\n        </tr>\n      `;\n    }).join('');\n  }\n\n  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();\n}\n\nasync function handleApproveLeave`;

const newLeaveEnd = `: '<span class="subtext" style="font-size: 11px;">Request Closed</span>')}\n          </td>\n        </tr>\n      `;\n      }).join('');\n    }\n  }\n\n  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();\n}\n\nasync function handleApproveLeave`;

console.log('Replacing leave end:', content.includes(oldLeaveEnd));
content = content.replace(oldLeaveEnd, newLeaveEnd);

// 2. Fix fetchDirectorPlanner:
const oldPlannerEnd = `        <td><strong>\${escapeHtml(t.topic)}</strong></td>\n      </tr>\n    \`).join('');\n  }\n\n  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();\n}\n\n/**\n * 5.5 DIRECTOR LEAVE`;

const newPlannerEnd = `        <td><strong>\${escapeHtml(t.topic)}</strong></td>\n      </tr>\n    \`).join('');\n    }\n  }\n\n  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();\n}\n\n/**\n * 5.5 DIRECTOR LEAVE`;

console.log('Replacing planner end:', content.includes(oldPlannerEnd));
content = content.replace(oldPlannerEnd, newPlannerEnd);

fs.writeFileSync('BrainzOS.html', content, 'utf8');
console.log('Saved BrainzOS.html with fixed braces.');
