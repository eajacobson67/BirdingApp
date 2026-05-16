import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLUR_SIGMA = 1.5;

const birds = [
  ['waxwing',        'cedar_waxwing.png'],
  ['cardinal',       'cardinal.png'],
  ['robin',          'robin.png'],
  ['hummingbird',    'hummingbird.png'],
  ['paintedbunting', 'painted_bunting.png'],
];

const assetsDir = path.join(__dirname, '..', 'assets', 'birds');

for (const [birdId, filename] of birds) {
  const src = path.join(assetsDir, filename);
  if (!fs.existsSync(src)) {
    console.log(`  skip ${filename} (not found)`);
    continue;
  }

  const img = sharp(src);
  const { width, height } = await img.metadata();
  const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // Zero RGB channels, keep alpha — produces a black silhouette
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
  }

  const out = path.join(assetsDir, `${birdId}_shadow.png`);
  await sharp(Buffer.from(data), { raw: { width, height, channels: 4 } })
    .blur(BLUR_SIGMA)
    .png()
    .toFile(out);

  console.log(`  wrote ${path.basename(out)}`);
}

console.log('Done.');
