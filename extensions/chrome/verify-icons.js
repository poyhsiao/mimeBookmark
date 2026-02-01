#!/usr/bin/env node
 
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
 
(async () => {
  const iconsDir = path.join(__dirname, 'icons');
  const iconFiles = ['icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-128.png'];

  const browser = await chromium.launch();
  let page = null;

  try {
    page = await browser.newPage();

    console.log('Extension Icon Size Verification:\n');

    for (const filename of iconFiles) {
      const iconPath = path.join(iconsDir, filename);
      if (!fs.existsSync(iconPath)) {
        console.log(`❌ ${filename}: FILE NOT FOUND`);
        continue;
      }

      const tempHtml = path.join(iconsDir, 'temp-check.html');
      try {
        // Normalize paths for file:// URLs (handles Windows backslashes)
        const iconUrl = pathToFileURL(iconPath).href;
        const html = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;display:block;}</style></head><body><img src="${iconUrl}" id="icon"></body></html>`;
        fs.writeFileSync(tempHtml, html);

        await page.goto(pathToFileURL(tempHtml).href);
        // Wait for image to load before reading dimensions
        await page.evaluate(() => {
          const img = document.getElementById('icon');
          if (!img.complete || img.naturalWidth === 0) {
            return new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              setTimeout(reject, 5000);
            });
          }
        });
        const dimensions = await page.evaluate(() => {
          const img = document.getElementById('icon');
          return { width: img.naturalWidth, height: img.naturalHeight };
        });

        const expectedSize = parseInt(filename.replace('icon-', '').replace('.png', ''));
        const isCorrectSize = dimensions.width === expectedSize && dimensions.height === expectedSize;
        const fileSize = (fs.statSync(iconPath).size / 1024).toFixed(2);

        if (isCorrectSize) {
          console.log(`✅ ${filename}: ${dimensions.width}x${dimensions.height}px (${fileSize}KB)`);
        } else {
          console.log(`❌ ${filename}: ${dimensions.width}x${dimensions.height}px (${fileSize}KB) - Expected ${expectedSize}x${expectedSize}`);
        }
      } catch (error) {
        console.log(`❌ ${filename}: ERROR - ${error.message}`);
      } finally {
        // Always clean up temp file
        if (fs.existsSync(tempHtml)) {
          fs.unlinkSync(tempHtml);
        }
      }
    }

    console.log('\nChrome Web Store Requirements:');
    console.log('  • 16x16px PNG (required)');
    console.log('  • 48x48px PNG (required)');
    console.log('  • 128x128px PNG (required)');
    console.log('  • 32x32px PNG (recommended)');
    console.log('  • All icons must be PNG format');

    process.exit(0);
  } catch (error) {
    console.error('\nError:', error.message);

    console.log('\nChrome Web Store Requirements:');
    console.log('  • 16x16px PNG (required)');
    console.log('  • 48x48px PNG (required)');
    console.log('  • 128x128px PNG (required)');
    console.log('  • 32x32px PNG (recommended)');
    console.log('  • All icons must be PNG format');

    process.exit(1);
  } finally {
    if (page) {
      await page.close();
    }
    await browser.close();
  }

})();
