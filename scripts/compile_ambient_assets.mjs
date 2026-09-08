#!/usr/bin/env node
/* Import generated plates/atlases; preserve alpha and fixed-cell registration. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { default: sharp } = await import(require.resolve('sharp', { paths: [require.resolve('next/package.json')] }));

async function main() {
  const [source, destination, mode = 'atlas'] = process.argv.slice(2);
  if (!source || !destination) throw new Error('Usage: compile_ambient_assets.mjs SOURCE OUTPUT [atlas|plaine|tavern|rotor|flag]');
  const metadata = await sharp(source).metadata();
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  // Same exterior-only matte import as prepare_flat_asset.py. Enclosed highlights
  // and parchment stay intact. Never run this on sources with their own alpha.
  if (!metadata.hasAlpha) {
    const seen = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0, tail = 0;
    const add = p => {
      if (seen[p]) return;
      seen[p] = 1;
      const i = p * 4;
      const channels = [data[i], data[i + 1], data[i + 2]];
      if (Math.min(...channels) >= 60 && Math.max(...channels) - Math.min(...channels) <= 42) queue[tail++] = p;
    };
    for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x); }
    for (let y = 0; y < height; y++) { add(y * width); add(y * width + width - 1); }
    while (head < tail) {
      const p = queue[head++], x = p % width, y = Math.floor(p / width);
      data.fill(0, p * 4, p * 4 + 4);
      if (x) add(p - 1); if (x + 1 < width) add(p + 1);
      if (y) add(p - width); if (y + 1 < height) add(p + width);
    }
  }
  const raw = { width, height, channels: 4 };
  let output;
  if (mode === 'atlas') {
    const columns = 4, rows = 2, cellWidth = Math.floor(width / columns), cellHeight = Math.floor(height / rows);
    const ratio = Math.min(248 / cellWidth, 304 / cellHeight);
    const tiles = [], sizes = [];
    for (let row = 0; row < rows; row++) {
      const bounds = [];
      for (let col = 0; col < columns; col++) {
        let top = cellHeight, bottom = 0;
        for (let y = 0; y < cellHeight; y++) for (let x = 0; x < cellWidth; x++) {
          if (data[((row * cellHeight + y) * width + col * cellWidth + x) * 4 + 3] > 128) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
        }
        if (bottom <= top) throw new Error(`Empty atlas cell ${row}:${col}`);
        bounds.push({ top, bottom });
      }
      const baseline = Math.max(...bounds.map(b => b.bottom));
      for (let col = 0; col < columns; col++) {
        const cropHeight = Math.min(cellHeight, baseline + 2);
        const tile = await sharp(data, { raw }).extract({ left: col * cellWidth, top: row * cellHeight, width: cellWidth, height: cropHeight })
          .resize(Math.round(cellWidth * ratio), Math.round(cropHeight * ratio)).png().toBuffer();
        const tileTop = Math.round(312 - baseline * ratio);
        tiles.push({ input: tile, left: col * 256 + Math.round((256 - cellWidth * ratio) / 2), top: row * 320 + tileTop });
        sizes.push(Math.round((bounds[col].bottom - bounds[col].top) * ratio));
      }
    }
    output = sharp({ create: { width: 1024, height: 640, channels: 4, background: '#00000000' } }).composite(tiles);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination.replace(/\.webp$/, '.json'), JSON.stringify({ columns: 4, rows: 2, width: 256, height: 320, baseline: 312, heights: sizes }, null, 2) + '\n');
  } else if (mode === 'flag') {
    // A tiny existing flag must not retain the entire former landscape in VRAM.
    output = sharp(data, { raw }).extract({ left: 252, top: 27, width: 36, height: 31 });
  } else {
    const size = { plaine: [1400, 584], tavern: [960, 549], rotor: [512, 512] }[mode];
    if (!size) throw new Error(`Unknown mode ${mode}`);
    output = sharp(data, { raw }).resize(...size, { fit: 'fill' });
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await output.webp({ quality: 92, effort: 6 }).toFile(destination + '.tmp');
  await fs.rename(destination + '.tmp', destination);
  console.log(destination);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
