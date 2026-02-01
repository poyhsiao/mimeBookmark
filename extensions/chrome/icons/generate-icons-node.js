const fs = require('fs');
const path = require('path');

(async () => {
  const svgPath = path.join(__dirname, 'icon-source.svg');
  const icon48Path = path.join(__dirname, 'icon-48.png');
  const icon128Path = path.join(__dirname, 'icon-128.png');

  if (!fs.existsSync(svgPath)) {
    console.error('icon-source.svg not found');
    process.exit(1);
  }

  // Dynamic require after checking file exists - requires canvas@^2.11.2 to be installed
  let createCanvas, loadImage;
  try {
    ({ createCanvas, loadImage } = require('canvas'));
  } catch (error) {
    console.error('canvas package not found. Please install it first:');
    console.error('  npm install canvas@^2.11.2');
    console.error('\nThen run this script again.');
    process.exit(1);
  }

  try {
    console.log('Converting SVG to 48x48 PNG...');
    const canvas48 = createCanvas(48, 48);
    const ctx48 = canvas48.getContext('2d');
    // Pass the file path directly to loadImage instead of SVG content
    const img48 = await loadImage(svgPath);
    ctx48.drawImage(img48, 0, 0, 48, 48);
    const buffer48 = canvas48.toBuffer('image/png');
    fs.writeFileSync(icon48Path, buffer48);
    console.log('✓ Created icon-48.png');

    console.log('Converting SVG to 128x128 PNG...');
    const canvas128 = createCanvas(128, 128);
    const ctx128 = canvas128.getContext('2d');
    // Pass the file path directly to loadImage instead of SVG content
    const img128 = await loadImage(svgPath);
    ctx128.drawImage(img128, 0, 0, 128, 128);
    const buffer128 = canvas128.toBuffer('image/png');
    fs.writeFileSync(icon128Path, buffer128);
    console.log('✓ Created icon-128.png');

    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nAlternative: Open convert.html in your browser to generate icons manually');
    process.exit(1);
  }
})();
