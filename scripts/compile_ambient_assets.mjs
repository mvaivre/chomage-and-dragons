#!/usr/bin/env node
/* Import generated plates/atlases; preserve alpha and fixed-cell registration. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { default: sharp } = await import(require.resolve('sharp', { paths: [require.resolve('next/package.json')] }));

/** Generated gutters aren't always a perfect grid. Find the large isolated silhouettes. */
function islands(data, width, height, count, columns) {
  const seen = new Uint8Array(width * height), owners = new Int32Array(width * height), queue = new Int32Array(width * height), found = [];
  for (let p = 0; p < seen.length; p++) {
    if (seen[p] || data[p * 4 + 3] < 3) continue;
    let head = 0, tail = 1, left = width, right = 0, top = height, bottom = 0;
    seen[p] = 1; queue[0] = p;
    const add = q => { if (!seen[q] && data[q * 4 + 3] >= 3) { seen[q] = 1; queue[tail++] = q; } };
    while (head < tail) {
      const q = queue[head++], x = q % width, y = Math.floor(q / width);
      owners[q] = p + 1;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      if (x) add(q - 1); if (x + 1 < width) add(q + 1);
      if (y) add(q - width); if (y + 1 < height) add(q + width);
    }
    if (tail > 200) found.push({ left: Math.max(0, left - 2), top: Math.max(0, top - 2), right: Math.min(width - 1, right + 2), bottom: Math.min(height - 1, bottom + 2), area: tail, owner: p + 1 });
  }
  const major = found.sort((a,b) => b.area - a.area).slice(0, count);
  if (major.length !== count) throw new Error(`Expected ${count} silhouettes, found ${major.length}`);
  // Keep complete connected silhouettes, not stray captions or ink in the gutters.
  const kept = new Set(major.map(b => b.owner));
  for (let p = 0; p < owners.length; p++) if (!kept.has(owners[p])) data[p * 4 + 3] = 0;
  major.sort((a,b) => (a.top + a.bottom) - (b.top + b.bottom));
  const ordered = [];
  for (let i = 0; i < count; i += columns) ordered.push(...major.slice(i, i + columns).sort((a,b) => a.left - b.left));
  return ordered;
}

async function main() {
  const [source, destination, mode = 'atlas', ...args] = process.argv.slice(2);
  if (!source || !destination) throw new Error('Usage: compile_ambient_assets.mjs SOURCE OUTPUT [atlas|cutout|tile|plaine|tavern|rotor|flag] [--columns=N --rows=N --cell-width=N --cell-height=N --baseline=N --output-width=N --output-height=N --opaque]');
  const options = Object.fromEntries(args.map(arg => arg.replace(/^--/, '').split('=')));
  const number = (name, fallback) => {
    const value = Number(options[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid ${name}: ${value}`);
    return value;
  };
  const metadata = await sharp(source).metadata();
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  // Same exterior-only matte import as prepare_flat_asset.py. Enclosed highlights
  // and parchment stay intact. Never run this on sources with their own alpha.
  if (!metadata.hasAlpha && !Object.hasOwn(options, 'opaque') && mode !== 'tile') {
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
  let registration;
  if (mode === 'atlas') {
    const columns = number('columns', 4), rows = number('rows', 2);
    const outWidth = number('cell-width', 256), outHeight = number('cell-height', 320), footline = number('baseline', 312);
    if (footline >= outHeight) throw new Error('Baseline must leave a transparent bottom margin');
    const cellWidth = Math.floor(width / columns), cellHeight = Math.floor(height / rows);
    const ratio = Math.min((outWidth - 16) / cellWidth, (footline - 8) / cellHeight);
    const tiles = [], sizes = [];
    const silhouettes = Object.hasOwn(options, 'islands') ? islands(data, width, height, columns * rows, columns) : null;
    for (let row = 0; row < rows; row++) {
      if (silhouettes) {
        const group = silhouettes.slice(row * columns, (row + 1) * columns);
        const scale = Math.min(...group.map(b => Math.min((outWidth - 20) / (b.right - b.left + 1), (footline - 10) / (b.bottom - b.top + 1))));
        for (let col = 0; col < columns; col++) {
          const b = group[col], w = b.right - b.left + 1, h = b.bottom - b.top + 1;
          const tw = Math.round(w * scale), th = Math.round(h * scale);
          const resized = await sharp(data, {raw}).extract({left:b.left,top:b.top,width:w,height:h}).resize(tw,th).raw().toBuffer();
          let bottom = 0;
          for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (resized[(y * tw + x) * 4 + 3] > 32) bottom = y;
          const tile = await sharp(resized, {raw:{width:tw,height:th,channels:4}}).png().toBuffer();
          tiles.push({input:tile,left:col*outWidth+Math.round((outWidth-tw)/2),top:row*outHeight+footline-bottom});
          sizes.push(th);
        }
        continue;
      }
      const bounds = [];
      for (let col = 0; col < columns; col++) {
        let top = cellHeight, bottom = 0;
        for (let y = 0; y < cellHeight; y++) for (let x = 0; x < cellWidth; x++) {
          if (data[((row * cellHeight + y) * width + col * cellWidth + x) * 4 + 3] > 128) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
        }
        if (bottom <= top) throw new Error(`Empty atlas cell ${row}:${col}`);
        bounds.push({ top, bottom });
      }
      for (let col = 0; col < columns; col++) {
        const baseline = bounds[col].bottom;
        const cropHeight = Math.min(cellHeight, baseline + 2);
        const tile = await sharp(data, { raw }).extract({ left: col * cellWidth, top: row * cellHeight, width: cellWidth, height: cropHeight })
          .resize(Math.round(cellWidth * ratio), Math.round(cropHeight * ratio)).png().toBuffer();
        const tileTop = Math.round(footline - baseline * ratio);
        tiles.push({ input: tile, left: col * outWidth + Math.round((outWidth - cellWidth * ratio) / 2), top: row * outHeight + tileTop });
        sizes.push(Math.round((bounds[col].bottom - bounds[col].top) * ratio));
      }
    }
    output = sharp({ create: { width: columns * outWidth, height: rows * outHeight, channels: 4, background: '#00000000' } }).composite(tiles);
    registration = { columns, rows, width: outWidth, height: outHeight, baseline: footline, heights: sizes };
  } else if (mode === 'cutout' || mode === 'tile') {
    const w = number('output-width', width), h = number('output-height', height);
    output = sharp(data, { raw }).resize(w, h, { fit: 'fill' });
    if (mode === 'tile') {
      // Blend the overlap of the two edges; lossless WebP keeps their equality after decoding.
      const pixels = await output.raw().toBuffer();
      const overlap = Math.min(64, Math.floor(w / 8));
      for (let y = 0; y < h; y++) for (let x = 0; x < overlap; x++) for (let c = 0; c < 4; c++) {
        const left = (y * w + x) * 4 + c, right = (y * w + w - 1 - x) * 4 + c;
        const average = (pixels[left] + pixels[right]) / 2, t = x / overlap;
        pixels[left] = Math.round(average * (1 - t) + pixels[left] * t);
        pixels[right] = Math.round(average * (1 - t) + pixels[right] * t);
      }
      output = sharp(pixels, { raw: { width: w, height: h, channels: 4 } });
    }
    registration = { columns: 1, rows: 1, width: w, height: h, baseline: number('baseline', h - 1), heights: [h], tile: mode === 'tile' };
  } else if (mode === 'flag') {
    // A tiny existing flag must not retain the entire former landscape in VRAM.
    output = sharp(data, { raw }).extract({ left: 252, top: 27, width: 36, height: 31 });
  } else {
    const size = { plaine: [1400, 584], tavern: [960, 549], rotor: [512, 512] }[mode];
    if (!size) throw new Error(`Unknown mode ${mode}`);
    output = sharp(data, { raw }).resize(...size, { fit: 'fill' });
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await output.webp({ quality: 92, effort: 6, lossless: mode === 'tile' }).toFile(destination + '.tmp');
  await fs.rename(destination + '.tmp', destination);
  if (registration) await fs.writeFile(destination.replace(/\.webp$/, '.json'), JSON.stringify(registration, null, 2) + '\n');
  // Contact sheets are review artifacts, never downloaded by the game.
  if (destination.includes('/decor/')) {
    const preview = path.join('docs/decor-previews', path.basename(destination, '.webp') + '.png');
    await fs.mkdir(path.dirname(preview), { recursive: true });
    await sharp(destination).flatten({ background: '#d3cbc0' }).resize({ width: 960, withoutEnlargement: true }).png().toFile(preview);
  }
  console.log(destination);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
