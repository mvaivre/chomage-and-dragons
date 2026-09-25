/** Import a matte-only ImageGen retouch without repacking animation cells. */
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const sharp = require(require.resolve('sharp', { paths: [require.resolve('next/package.json')] }));
const [id, source] = process.argv.slice(2);
if (!/^[a-z]+$/.test(id ?? '') || !source) throw new Error('Usage: node scripts/import-character-cleanup.mjs ID SOURCE.png [--register] [--reference REF]');
const destination = `public/art/world-v3/animations/${id}.webp`;
const metadata = JSON.parse(await fs.readFile(destination.replace('.webp', '.json'), 'utf8'));
const width = metadata.width * metadata.columns, height = metadata.height * metadata.rows;
const referenceFlag = process.argv.indexOf('--reference');
const reference = referenceFlag < 0 ? 'HEAD' : process.argv[referenceFlag + 1];
if (!reference) throw new Error('Missing reference revision');
const before = await sharp(execFileSync('git', ['show', `${reference}:${destination}`])).ensureAlpha().raw().toBuffer();
const input = await sharp(source).metadata();
if (!input.hasAlpha || Math.abs(input.width / input.height - width / height) > .005) throw new Error('Retouch lost transparency or atlas aspect ratio');
let raw = await sharp(source).resize(width, height).ensureAlpha().raw().toBuffer();
// Generated exports can shift a pose within its cell. Register only those
// exports, preserving each original pose's own dimensions and foot position.
if (process.argv.includes('--register')) {
  const overlays = [];
  const bounds = (data, cell) => {
    let left = metadata.width, top = metadata.height, right = -1, bottom = -1;
    for (let y = 0; y < metadata.height; y++) for (let x = 0; x < metadata.width; x++) {
      const i = ((Math.floor(cell / metadata.columns) * metadata.height + y) * width + cell % metadata.columns * metadata.width + x) * 4;
      if (data[i + 3] <= 128) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < left) throw new Error(`${id}:${cell} lost its silhouette`);
    return { left: left - 2, top: top - 2, width: right - left + 5, height: bottom - top + 5 };
  };
  for (let cell = 0; cell < metadata.count; cell++) {
    const old = bounds(before, cell), next = bounds(raw, cell);
    const x = cell % metadata.columns * metadata.width, y = Math.floor(cell / metadata.columns) * metadata.height;
    const input = await sharp(raw, { raw: { width, height, channels: 4 } })
      .extract({ ...next, left: x + next.left, top: y + next.top })
      .resize(old.width, old.height, { fit: 'fill' }).png().toBuffer();
    overlays.push({ input, left: x + old.left, top: y + old.top });
  }
  raw = await sharp({ create: { width, height, channels: 4, background: '#00000000' } }).composite(overlays).raw().toBuffer();
}
// Compare palette at low frequency: resampling a black outline by half a pixel
// must not be mistaken for a changed interior colour.
const smoothBefore = await sharp(before, { raw: { width, height, channels: 4 } }).blur(2).raw().toBuffer();
const smoothAfter = await sharp(raw, { raw: { width, height, channels: 4 } }).blur(2).raw().toBuffer();
const reports = [];
for (let cell = 0; cell < metadata.count; cell++) {
  let intersection = 0, union = 0, interiorError = 0, interior = 0, paleEdge = 0, oldPaleEdge = 0;
  const bottom = [-1, -1];
  for (let y = 0; y < metadata.height; y++) for (let x = 0; x < metadata.width; x++) {
    const i = ((Math.floor(cell / metadata.columns) * metadata.height + y) * width + cell % metadata.columns * metadata.width + x) * 4;
    const a = before[i + 3], b = raw[i + 3];
    if (a > 128 || b > 128) union++;
    if (a > 128 && b > 128) intersection++;
    if (a > 128) bottom[0] = y;
    if (b > 128) bottom[1] = y;
    if (a > 245 && b > 245) {
      interior++;
      interiorError += (Math.abs(smoothBefore[i] - smoothAfter[i]) + Math.abs(smoothBefore[i+1] - smoothAfter[i+1]) + Math.abs(smoothBefore[i+2] - smoothAfter[i+2])) / 3;
    }
    if (a >= 20 && a < 220 && Math.min(before[i], before[i+1], before[i+2]) > 160) oldPaleEdge++;
    if (b >= 20 && b < 220 && Math.min(raw[i], raw[i+1], raw[i+2]) > 160) paleEdge++;
    if ((x === 0 || y === 0 || x === metadata.width - 1 || y === metadata.height - 1) && b > 20) throw new Error(`${id}:${cell} lost its transparent gutter`);
  }
  const overlap = intersection / union;
  const colorError = interiorError / interior;
  if (overlap < .90 || Math.abs(bottom[0] - bottom[1]) > 3 || colorError > 24) throw new Error(`${id}:${cell} changed registration or drawing: ${JSON.stringify({overlap,bottom,colorError})}`);
  reports.push({ cell, overlap: +overlap.toFixed(3), footShift: bottom[1] - bottom[0], colorError: +colorError.toFixed(2), oldPaleEdge, paleEdge });
}
const temporary = destination.replace('.webp', '.tmp.webp');
await sharp(raw, { raw: { width, height, channels: 4 } }).webp({ quality: 90, effort: 6 }).toFile(temporary);
await fs.rename(temporary, destination);
console.log(JSON.stringify({ id, source, destination, reports }));
