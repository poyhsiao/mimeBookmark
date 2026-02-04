const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  console.log('Browser launched, creating page...');
  const page = await browser.newPage();
  console.log('Page created, navigating...');
  
  page.on('console', msg => console.log('Console:', msg.text()));
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('Page loaded!');
  
  const title = await page.title();
  console.log('Title:', title);
  
  await browser.close();
  console.log('Done!');
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
