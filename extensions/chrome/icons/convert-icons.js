#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function svgToPng(svgContent, outputPath, size) {
  try {
    // Create a Buffer from the SVG content
    const svgBuffer = Buffer.from(svgContent);

    // Use sharp to convert SVG to PNG
    await sharp(svgBuffer, { density: 300 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outputPath);

    return outputPath;
  } catch (error) {
    throw new Error(`Failed to convert SVG to PNG: ${error.message}`);
  }
}

(async () => {
  const svgPath = path.join(__dirname, 'icon-source.svg');
  const icon48Path = path.join(__dirname, 'icon-48.png');
  const icon128Path = path.join(__dirname, 'icon-128.png');

  if (!fs.existsSync(svgPath)) {
    console.error('icon-source.svg not found');
    process.exit(1);
  }

  const svgContent = fs.readFileSync(svgPath, 'utf8');

  try {
    console.log('Converting SVG to 48x48 PNG...');
    await svgToPng(svgContent, icon48Path, 48);
    console.log('✓ Created icon-48.png');

    console.log('Converting SVG to 128x128 PNG...');
    await svgToPng(svgContent, icon128Path, 128);
    console.log('✓ Created icon-128.png');

    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
})();
