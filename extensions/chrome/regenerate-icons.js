const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const svgPath = path.join(__dirname, 'icons/icon-source.svg');
  const convertHtml = path.join(__dirname, 'icons/convert-temp.html');

  if (!fs.existsSync(svgPath)) {
    console.error('icon-source.svg not found');
    process.exit(1);
  }

  const svgContent = fs.readFileSync(svgPath, 'utf8');

  const sizes = [
    { size: 16, path: path.join(__dirname, 'icons/icon-16.png') },
    { size: 32, path: path.join(__dirname, 'icons/icon-32.png') },
    { size: 48, path: path.join(__dirname, 'icons/icon-48.png') },
    { size: 128, path: path.join(__dirname, 'icons/icon-128.png') }
  ];

  let browser = null;
  let page = null;

  try {
    browser = await chromium.launch();
    page = await browser.newPage();

    for (const { size, path: outputPath } of sizes) {
      console.log(`Generating icon-${size}.png (${size}x${size})...`);

      const html = `<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;width:${size}px;height:${size}px;}svg{width:100%;height:100%;}</style></head><body>${svgContent}</body></html>`;
      fs.writeFileSync(convertHtml, html);
      await page.goto(`file://${convertHtml}`);
      await page.setViewportSize({ width: size, height: size });

      await page.screenshot({ path: outputPath, type: 'png' });
      console.log(`✓ Created icon-${size}.png (${size}x${size})`);
    }

    console.log('\nAll icons generated successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    // Cleanup resources
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
    if (fs.existsSync(convertHtml)) {
      fs.unlinkSync(convertHtml);
    }
  }
})();
