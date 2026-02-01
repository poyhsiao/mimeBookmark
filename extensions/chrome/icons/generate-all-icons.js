const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const svgPath = path.join(__dirname, 'icon-source.svg');

  if (!fs.existsSync(svgPath)) {
    console.error('icon-source.svg not found');
    process.exit(1);
  }

  let svgContent = fs.readFileSync(svgPath, 'utf8');

  // Normalize SVG to scale properly by stripping fixed width/height and adding CSS
  svgContent = svgContent.replace(/\s(width|height)="[^"]*"/g, '');
  svgContent = svgContent.replace('<svg', '<svg style="width:100%;height:100%;display:block;"');

  const sizes = [
    { size: 16, path: path.join(__dirname, 'icon-16.png') },
    { size: 32, path: path.join(__dirname, 'icon-32.png') },
    { size: 48, path: path.join(__dirname, 'icon-48.png') },
    { size: 128, path: path.join(__dirname, 'icon-128.png') }
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

      const html = `<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;background:transparent;}</style></head><body>${svgContent}</body></html>`;
      await page.setContent(html);

      await page.screenshot({ path: outputPath, type: 'png', omitBackground: true });
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
  }
})();
