const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/BrainzOS.html');
  await page.fill('#school-email', 'teacher@brainz.edu');
  await page.fill('#school-password', 'Password123!');
  await page.click('#continue-btn');
  await page.waitForTimeout(1000);

  // Navigate to Class Assignments
  await page.click('#nav-teacher-assignments');
  await page.waitForTimeout(500);

  // Open modal
  await page.click('button:has-text("+ New Assignment")');
  await page.waitForTimeout(500);

  // Fill in fields exactly as in user screenshot
  await page.fill('#new-assign-title', 'Demand');
  await page.fill('#new-assign-due', 'Sep 30');
  await page.fill('#new-assign-desc', 'Solve the whole exercise');
  
  // Click Add Assignment
  await page.click('#new-assign-submit-btn');
  await page.waitForTimeout(1000);

  // Verify modal is closed
  const modalActive = await page.locator('#new-assignment-modal').getAttribute('class');
  console.log('Modal class:', modalActive);

  // Check toast
  const toastTitle = await page.locator('#toast-title').textContent();
  const toastMsg = await page.locator('#toast-message').textContent();
  console.log('Toast:', { toastTitle, toastMsg });

  // Check grid contains new assignment
  const gridText = await page.locator('#assignments-grid-container').textContent();
  console.log('Grid contains Demand:', gridText.includes('Demand'));
  console.log('Grid preview:', gridText.trim().replace(/\s+/g, ' ').slice(0, 150));

  await browser.close();
})();
