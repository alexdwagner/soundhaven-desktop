const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    // iPhone 13 Pro mobile viewport
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
  });

  const page = await context.newPage();
  
  // Collect console messages and errors
  const errors = [];
  const logs = [];
  
  page.on('console', msg => {
    logs.push(`${msg.type()}: ${msg.text()}`);
    console.log(`${msg.type()}: ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
    console.error('Page Error:', error.message);
  });

  // Navigate to your app
  await page.goto('http://localhost:3001');
  
  // Wait for app to load
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'mobile-ui-debug.png', fullPage: true });
  
  console.log('\n=== ERRORS FOUND ===');
  errors.forEach((error, i) => console.log(`${i + 1}. ${error}`));
  
  console.log('\n=== CONSOLE LOGS ===');
  logs.forEach((log, i) => console.log(`${i + 1}. ${log}`));
  
  console.log('\nScreenshot saved as: mobile-ui-debug.png');
  
  await browser.close();
})();