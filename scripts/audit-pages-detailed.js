const fs = require('fs');

const content = fs.readFileSync('BrainzOS.html', 'utf8');

// List of all page IDs
const pages = [
  'login-viewport',
  'GLOBAL_SHELL',
  'page-student-dashboard',
  'page-student-timetable',
  'page-student-assignments',
  'page-student-pass',
  'page-student-clubs',
  'page-student-results',
  'page-student-detail',
  'page-teacher-overview',
  'page-teacher-manage-students',
  'page-teacher-roster',
  'page-teacher-attendance',
  'page-teacher-attendance-reports',
  'page-teacher-test-schedule',
  'page-teacher-gradebook',
  'page-teacher-assignments',
  'page-teacher-planner',
  'page-teacher-leave',
  'page-teacher-broadcasts',
  'page-teacher-final-marks',
  'page-director-analytics',
  'page-director-teacher-roster',
  'page-director-teachers',
  'page-director-attendance-reports',
  'page-director-test-schedule',
  'page-director-leave',
  'page-director-planner',
  'page-director-feed',
  'page-director-audit',
  'page-director-promotion',
  'page-director-teacher-detail',
  'page-404',
  'MODALS'
];

console.log('Total pages & sections to audit:', pages.length);
