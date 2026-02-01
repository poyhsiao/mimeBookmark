const fs = require('fs');
const path = require('path');

(async () => {
  const svgPath = path.join(__dirname, 'icon-source.svg');
  const sizes = [16, 32, 48, 128];

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
    const img = await loadImage(svgPath);
    
    for (const size of sizes) {
      console.log(`Converting SVG to ${size}x${size} PNG...`);
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(path.join(__dirname, `icon-${size}.png`), buffer);
      console.log(`✓ Created icon-${size}.png`);
    }

    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nAlternative: Open convert.html in your browser to generate icons manually');
    process.exit(1);
  }
})();
