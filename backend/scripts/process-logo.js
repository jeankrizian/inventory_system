/**
 * Remove outer white background from Cavite Institute logo (flood-fill from edges).
 * Run: node scripts/process-logo.js
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const SOURCE = path.join(__dirname, '../../frontend/images/cavite-institute-logo-source.png');

const OUT_DIR = path.join(__dirname, '../../frontend/images');
const OUT_LOGO = path.join(OUT_DIR, 'cavite-institute-logo.png');
const OUT_FAVICON = path.join(OUT_DIR, 'favicon.png');

function isBackgroundWhite(r, g, b, a, threshold = 245) {
  return a > 200 && r >= threshold && g >= threshold && b >= threshold;
}

function floodFillBackground(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  for (let x = 0; x < width; x++) {
    queue.push([x, 0], [x, height - 1]);
  }
  for (let y = 0; y < height; y++) {
    queue.push([0, y], [width - 1, y]);
  }

  while (queue.length) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const idx = y * width + x;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const i = idx * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (!isBackgroundWhite(r, g, b, a)) continue;

    data[i + 3] = 0;

    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

async function processLogo() {
  const sourcePath = fs.existsSync(SOURCE)
    ? SOURCE
    : path.join(__dirname, '../../frontend/images/cavite-institute-logo-source.png');

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source logo not found: ${sourcePath}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  floodFillBackground(pixels, info.width, info.height);

  await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(OUT_LOGO);

  await sharp(OUT_LOGO)
    .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(OUT_FAVICON);

  console.log('Logo saved:', OUT_LOGO);
  console.log('Favicon saved:', OUT_FAVICON);
}

processLogo().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
