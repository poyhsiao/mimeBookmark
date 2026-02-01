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

  if (!fs.existsSync(svgPath)) {
    console.error('icon-source.svg not found');
    process.exit(1);
  }

  const svgContent = fs.readFileSync(svgPath, 'utf8');

  const sizes = [
    { size: 16, path: path.join(__dirname, 'icon-16.png') },
    { size: 32, path: path.join(__dirname, 'icon-32.png') },
    { size: 48, path: path.join(__dirname, 'icon-48.png') },
    { size: 128, path: path.join(__dirname, 'icon-128.png') },
  ];

  try {
    for (const { size, path: outputPath } of sizes) {
      console.log(`Converting SVG to ${size}x${size} PNG...`);
      await svgToPng(svgContent, outputPath, size);
      console.log(`✓ Created icon-${size}.png`);
    }

    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
})();
