import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLUR_SIGMA = 1.5;

const birds = [
  'cedar_waxwing.png',
  'cardinal.png',
  'robin.png',
  'hummingbird.png',
  'painted_bunting.png',
  'house_sparrow.png',
  'scissor_tailed_flycatcher.png',
  'blue_jay.png',
];

const assetsDir   = path.join(__dirname, '..', 'assets', 'birds');
const shadowsDir  = path.join(assetsDir, 'shadows');
if (!fs.existsSync(shadowsDir)) fs.mkdirSync(shadowsDir);

for (const filename of birds) {
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

  const stem = filename.replace(/\.png$/i, '');
  const out = path.join(shadowsDir, `${stem}_shadow.png`);
  await sharp(Buffer.from(data), { raw: { width, height, channels: 4 } })
    .blur(BLUR_SIGMA)
    .png()
    .toFile(out);

  console.log(`  wrote ${path.basename(out)}`);
}

console.log('Done.');
