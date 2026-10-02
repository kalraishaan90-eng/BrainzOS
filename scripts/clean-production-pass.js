const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'BrainzOS.html');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Original file length:', content.length);

// 1. Update login description
content = content.replace(
  'Access your academic and administrative workspace. Select a demo identity below or enter your institutional credentials.',
  'Access your academic and administrative workspace. Sign in with your verified institutional credentials.'
);

// 2. Remove demo role pills HTML block
const demoPillsRegex = /<!-- Above-the-Fold Quick Launch Persona Selector[\s\S]*?<div class="demo-role-pills"[\s\S]*?<\/div>/;
if (demoPillsRegex.test(content)) {
  content = content.replace(demoPillsRegex, '<!-- Institutional Authentication Gateway -->');
  console.log('1. Removed demo persona selector pills.');
} else {
  console.log('WARN: demo persona selector pills not matched');
}

// 3. Remove "Demo: Password123!"
content = content.replace(
  '<span style="font-size: var(--text-xs); color: var(--color-ink-subtle);">Demo: Password123!</span>',
  ''
);
console.log('2. Removed Demo: Password123! text.');

// 4. Remove role detector box HTML
const roleDetectorRegex = /<!-- Live Role Detection Animated Banner -->\s*<div class="role-detection-box" id="role-detector-box">[\s\S]*?<\/div>/;
if (roleDetectorRegex.test(content)) {
  content = content.replace(roleDetectorRegex, '');
  console.log('3. Removed role detection banner box.');
} else {
  console.log('WARN: role detector box not matched');
}

// 5. Clean handleEmailInput (remove role guessing from email substrings)
const handleEmailInputOld = `function handleEmailInput(val) {
  clearLoginError();
  validateFormInputs();
  const lower = (val || '').toLowerCase().trim();
  if (lower.includes('student') || lower.includes('ishaan')) {
    updateRoleIndicatorUI('student');
  } else if (lower.includes('teacher') || lower.includes('aarav')) {
    updateRoleIndicatorUI('teacher');
  } else if (lower.includes('director') || lower.includes('rhea')) {
    updateRoleIndicatorUI('director');
  } else {
    updateRoleIndicatorUI(null);
  }
}`;

const handleEmailInputNew = `function handleEmailInput(val) {
  clearLoginError();
  validateFormInputs();
}`;

if (content.includes(handleEmailInputOld)) {
  content = content.replace(handleEmailInputOld, handleEmailInputNew);
  console.log('4. Cleaned handleEmailInput to remove role guessing.');
} else {
  // Regex fallback
  content = content.replace(/function handleEmailInput\(val\)[\s\S]*?validateFormInputs\(\);[\s\S]*?\n\}/, 'function handleEmailInput(val) {\n  clearLoginError();\n  validateFormInputs();\n}');
  console.log('4. Cleaned handleEmailInput via regex.');
}

// 6. Clean DEMO_PROFILES to have neutral empty fallbacks without fake mock names
const demoProfilesRegex = /const DEMO_PROFILES = \{[\s\S]*?\n\};/;
const cleanProfiles = `const DEMO_PROFILES = {
  student: {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Student Scholar',
    email: 'student@school.internal',
    role: 'student',
    roleLabel: 'Student',
    initials: 'ST',
    grade: 'Class Enrolled',
    classInfo: 'Senior Secondary',
    class_section: 'General',
    class_group: 'standard',
    stream: 'Academic',
    house: 'Nalanda',
    studentId: 'STU-001'
  },
  teacher: {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Faculty Instructor',
    email: 'teacher@school.internal',
    role: 'teacher',
    roleLabel: 'Teacher',
    initials: 'FI',
    class_section: 'General',
    grade: 'Instructional Faculty'
  },
  director: {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'School Director',
    email: 'director@school.internal',
    role: 'director',
    roleLabel: 'Director',
    initials: 'SD',
    grade: 'Executive Leadership'
  }
};`;

if (demoProfilesRegex.test(content)) {
  content = content.replace(demoProfilesRegex, cleanProfiles);
  console.log('5. Replaced DEMO_PROFILES with clean structural defaults.');
}

// 7. Clean hardcoded arrays: FACULTY_DIRECTORY, LEAVE_RECORDS_DATA, LECTURE_PLAN_DATA, TEST_SCHEDULE_DATA, SUBSTITUTIONS_DATA
const facultyDirRegex = /let FACULTY_DIRECTORY = \[\s*\{[\s\S]*?\];/;
if (facultyDirRegex.test(content)) {
  content = content.replace(facultyDirRegex, 'let FACULTY_DIRECTORY = [];');
  console.log('6. Initialized FACULTY_DIRECTORY as empty array.');
}

const leaveRecordsRegex = /let LEAVE_RECORDS_DATA = \[\s*\{[\s\S]*?\];/;
if (leaveRecordsRegex.test(content)) {
  content = content.replace(leaveRecordsRegex, 'let LEAVE_RECORDS_DATA = [];');
  console.log('7. Initialized LEAVE_RECORDS_DATA as empty array.');
}

const lecturePlanRegex = /let LECTURE_PLAN_DATA = \[\s*\{[\s\S]*?\];/;
if (lecturePlanRegex.test(content)) {
  content = content.replace(lecturePlanRegex, 'let LECTURE_PLAN_DATA = [];');
  console.log('8. Initialized LECTURE_PLAN_DATA as empty array.');
}

const testScheduleRegex = /let TEST_SCHEDULE_DATA = \[\s*\{[\s\S]*?\];/;
if (testScheduleRegex.test(content)) {
  content = content.replace(testScheduleRegex, 'let TEST_SCHEDULE_DATA = [];');
  console.log('9. Initialized TEST_SCHEDULE_DATA as empty array.');
}

const substitutionsRegex = /let SUBSTITUTIONS_DATA = \[\s*\{[\s\S]*?\];/;
if (substitutionsRegex.test(content)) {
  content = content.replace(substitutionsRegex, 'let SUBSTITUTIONS_DATA = [];');
  console.log('10. Initialized SUBSTITUTIONS_DATA as empty array.');
}

// 8. Clean STUDENTS_ROSTER_DATA and INITIAL_DOCUMENTS
const studentsRosterRegex = /let STUDENTS_ROSTER_DATA = \[\s*\{[\s\S]*?\];/;
if (studentsRosterRegex.test(content)) {
  content = content.replace(studentsRosterRegex, 'let STUDENTS_ROSTER_DATA = [];');
  console.log('11. Initialized STUDENTS_ROSTER_DATA as empty array.');
}

const docsStoreRegex = /let INITIAL_DOCUMENTS = \[\s*\{[\s\S]*?\];/;
if (docsStoreRegex.test(content)) {
  content = content.replace(docsStoreRegex, 'let INITIAL_DOCUMENTS = [];');
  console.log('12. Initialized INITIAL_DOCUMENTS as empty array.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Clean pass executed. New file length:', content.length);
