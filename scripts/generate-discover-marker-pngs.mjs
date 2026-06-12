#!/usr/bin/env node
/** One-off generator for Discover map marker PNGs (bitmap `image` prop — reliable on iOS MapKit). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/assets/discover-markers',
);

const SPECS = {
  bakery: { fill: [218, 113, 1], glyph: 'B' },
  cafe: { fill: [111, 78, 55], glyph: 'C' },
  meals: { fill: [198, 40, 40], glyph: 'M' },
  groceries: { fill: [46, 125, 50], glyph: 'G' },
  supermarket: { fill: [21, 101, 192], glyph: 'S' },
  shelf: { fill: [1, 105, 111], glyph: '★' },
  hybrid: { fill: [123, 31, 162], glyph: '±' },
  default: { fill: [1, 105, 111], glyph: '•' },
};

const W = 44;
const H = 52;
const CX = W / 2;
const HEAD_CY = 17;
const HEAD_R = 15;

function setPx(data, x, y, rgba) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (W * y + x) << 2;
  data[i] = rgba[0];
  data[i + 1] = rgba[1];
  data[i + 2] = rgba[2];
  data[i + 3] = rgba[3] ?? 255;
}

function inHead(x, y) {
  const dx = x - CX + 0.5;
  const dy = y - HEAD_CY + 0.5;
  return dx * dx + dy * dy <= HEAD_R * HEAD_R;
}

function inPointer(x, y) {
  if (y < HEAD_CY + HEAD_R - 4 || y > H - 2) return false;
  const t = (y - (HEAD_CY + HEAD_R - 4)) / (H - 2 - (HEAD_CY + HEAD_R - 4));
  const half = (1 - t) * 9 + 1;
  return Math.abs(x - CX + 0.5) <= half;
}

function drawGlyph(data, glyph, fill) {
  const patterns = {
    B: ['1110', '1010', '1110', '1010', '1110'],
    C: ['0110', '1000', '1000', '1000', '0110'],
    M: ['1001', '1101', '1011', '1001', '1001'],
    G: ['0110', '1000', '1011', '1001', '0110'],
    S: ['0110', '1000', '0110', '0011', '1100'],
    '★': ['0100', '1111', '1111', '0110', '1010'],
    '±': ['0000', '0110', '1111', '0110', '0000'],
    '•': ['0000', '0110', '0110', '0000', '0000'],
  };
  const rows = patterns[glyph] ?? patterns['•'];
  const gh = rows.length;
  const gw = rows[0].length;
  const sx = Math.round(CX - gw * 1.4);
  const sy = Math.round(HEAD_CY - gh * 1.2);
  for (let r = 0; r < gh; r++) {
    for (let c = 0; c < gw; c++) {
      if (rows[r][c] !== '1') continue;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          setPx(data, sx + c * 2 + dx, sy + r * 2 + dy, [255, 255, 255, 255]);
        }
      }
    }
  }
  void fill;
}

function renderMarker(name, spec) {
  const png = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = inHead(x, y) || inPointer(x, y);
      if (!edge) {
        setPx(png.data, x, y, [0, 0, 0, 0]);
        continue;
      }
      const border =
        inHead(x - 1, y) &&
        inHead(x + 1, y) &&
        inHead(x, y - 1) &&
        inHead(x, y + 1);
      const inner = inHead(x, y) && border;
      const ptrInner = inPointer(x, y) && !inHead(x, y);
      if (inner || ptrInner) {
        setPx(png.data, x, y, [...spec.fill, 255]);
      } else {
        setPx(png.data, x, y, [255, 255, 255, 255]);
      }
    }
  }
  drawGlyph(png.data, spec.glyph, spec.fill);
  return PNG.sync.write(png);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [name, spec] of Object.entries(SPECS)) {
  fs.writeFileSync(path.join(OUT, `${name}.png`), renderMarker(name, spec));
}
console.log('Wrote marker PNGs to', OUT);
