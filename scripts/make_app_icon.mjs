/**
 * Generates assets/icon.png (1024x1024) and assets/adaptive-icon.png (1024x1024)
 * from a source bird PNG.
 *
 * Usage: node scripts/make_app_icon.mjs [bird_filename]
 *   e.g. node scripts/make_app_icon.mjs blue_jay.png
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'assets');
const birdsDir  = path.join(assetsDir, 'birds');

const filename = process.argv[2] ?? 'blue_jay.png';
const BIRD_SRC = path.join(birdsDir, filename);

const SIZE    = 1024;
const BG      = { r: 238, g: 244, b: 252, alpha: 1 };  // #EEF4FC  — blue jay light bg

async function makeIcon(outPath, birdFraction) {
  const birdPx = Math.round(SIZE * birdFraction);
  const offset = Math.round((SIZE - birdPx) / 2);

  const bird = await sharp(BIRD_SRC)
    .resize(birdPx, birdPx, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: BG } })
    .composite([{ input: bird, left: offset, top: offset }])
    .png()
    .toFile(outPath);

  console.log(`  wrote ${path.basename(outPath)}`);
}

await makeIcon(path.join(assetsDir, 'icon.png'),          0.80);
await makeIcon(path.join(assetsDir, 'adaptive-icon.png'), 0.68);  // Android safe zone

console.log('Done.');
