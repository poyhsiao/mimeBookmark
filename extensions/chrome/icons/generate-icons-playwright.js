const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const svgPath = path.join(__dirname, 'icon-source.svg');
  const convertHtml = path.join(__dirname, 'convert-temp.html');
  const icon48Path = path.join(__dirname, 'icon-48.png');
  const icon128Path = path.join(__dirname, 'icon-128.png');

  if (!fs.existsSync(svgPath)) {
    console.error('icon-source.svg not found');
    process.exit(1);
  }

  const svgContent = fs.readFileSync(svgPath, 'utf8');

  const sizes = [
    { size: 48, path: icon48Path },
    { size: 128, path: icon128Path }
  ];

  let browser = null;
  let page = null;

  try {
    browser = await chromium.launch();
    page = await browser.newPage();

    for (const { size, path: outputPath } of sizes) {
      console.log(`Generating icon-${size}.png (${size}x${size})...`);

      // Set viewport size for each icon to ensure correct dimensions
      await page.setViewportSize({ width: size, height: size });

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            html, body { margin: 0; padding: 0; width: ${size}px; height: ${size}px; overflow: hidden; }
          </style>
        </head>
        <body>${svgContent}</body>
        </html>
      `;

      fs.writeFileSync(convertHtml, html);
      await page.goto(pathToFileURL(convertHtml).href);

      await page.screenshot({
        path: outputPath,
        type: 'png'
      });

      console.log(`✓ Created icon-${size}.png`);
    }

    console.log('\nAll icons generated successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
    if (fs.existsSync(convertHtml)) fs.unlinkSync(convertHtml);
  }
})();
