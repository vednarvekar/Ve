const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const output = path.join(__dirname, "../app/assets");
const supersample = 4;
const colors = {
  background: [10, 17, 25],
  mark: [240, 246, 249],
  accent: [83, 194, 207],
};
const logoSegments = [
  [[0.15, 0.27], [0.31, 0.74]],
  [[0.31, 0.74], [0.47, 0.27]],
  [[0.57, 0.50], [0.85, 0.50]],
];
const circleSegments = [];
{
  const center = [0.72, 0.50];
  const radius = 0.15;
  for (let degrees = -55; degrees >= -305; degrees -= 4) {
    const radians = degrees * Math.PI / 180;
    circleSegments.push([center[0] + Math.cos(radians) * radius, center[1] + Math.sin(radians) * radius]);
  }
  circleSegments.unshift([center[0] + Math.cos(-55 * Math.PI / 180) * radius, center[1] + Math.sin(-55 * Math.PI / 180) * radius]);
}
const accentCenter = [0.72 + Math.cos(-305 * Math.PI / 180) * 0.15, 0.50 + Math.sin(-305 * Math.PI / 180) * 0.15];

function distanceToSegment(x, y, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - start[0]) * dx + (y - start[1]) * dy) / lengthSquared));
  return Math.hypot(x - start[0] - t * dx, y - start[1] - t * dy);
}

function insideRoundedTile(x, y) {
  const qx = Math.abs(x - 0.5) - 0.30;
  const qy = Math.abs(y - 0.5) - 0.30;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) <= 0.14;
}

function markAt(x, y) {
  const thickness = 0.029;
  if (x >= 0.11 && x <= 0.51) {
    for (const [start, end] of logoSegments.slice(0, 2)) {
      if (distanceToSegment(x, y, start, end) <= thickness) return colors.mark;
    }
  }
  if (x >= 0.52 && x <= 0.89 && y >= 0.32 && y <= 0.68) {
    if (distanceToSegment(x, y, logoSegments[2][0], logoSegments[2][1]) <= thickness) return colors.mark;
    for (let index = 1; index < circleSegments.length; index += 1) {
      if (distanceToSegment(x, y, circleSegments[index - 1], circleSegments[index]) <= thickness) return colors.mark;
    }
  }

  if (Math.hypot(x - accentCenter[0], y - accentCenter[1]) <= 0.043) return colors.accent;
  return null;
}

function renderPng(size, withTile) {
  const pixels = Buffer.alloc(size * size * 4);
  const sampleCount = supersample * supersample;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          const x = (px + (sx + 0.5) / supersample) / size;
          const y = (py + (sy + 0.5) / supersample) / size;
          const inTile = withTile && insideRoundedTile(x, y);
          const mark = markAt(x, y);
          const color = mark ?? (inTile ? colors.background : null);
          if (!color) continue;
          red += color[0];
          green += color[1];
          blue += color[2];
          alpha += 255;
        }
      }
      const offset = (py * size + px) * 4;
      if (alpha === 0) continue;
      pixels[offset] = Math.round(red / (alpha / 255));
      pixels[offset + 1] = Math.round(green / (alpha / 255));
      pixels[offset + 2] = Math.round(blue / (alpha / 255));
      pixels[offset + 3] = Math.round(alpha / sampleCount);
    }
  }

  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    scanlines[row] = 0;
    pixels.copy(scanlines, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  return encodePng(size, scanlines);
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function encodePng(size, scanlines) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeSvg() {
  const ePoints = [];
  for (let degrees = -55; degrees >= -305; degrees -= 4) {
    const radians = degrees * Math.PI / 180;
    ePoints.push(`${(0.72 + Math.cos(radians) * 0.15) * 128},${(0.50 + Math.sin(radians) * 0.15) * 128}`);
  }
  const white = "#f0f6f9";
  const accent = "#53c2cf";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none"><g stroke="${white}" stroke-width="7.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19.2 34.6 39.7 94.7 60.2 34.6"/><path d="M72.96 64H108.8"/><polyline points="${ePoints.join(" ")}"/></g><circle cx="103.16" cy="79.7" r="5.5" fill="${accent}"/></svg>`;
}

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "ve-mark.svg"), makeSvg());
fs.writeFileSync(path.join(output, "logo.png"), renderPng(512, true));
fs.writeFileSync(path.join(output, "icon.png"), renderPng(512, true));
fs.writeFileSync(path.join(output, "app-icon.png"), renderPng(256, true));
fs.writeFileSync(path.join(output, "icon-128.png"), renderPng(128, true));
fs.writeFileSync(path.join(output, "tray-icon.png"), renderPng(24, false));
fs.writeFileSync(path.join(output, "tray-icon@2x.png"), renderPng(48, false));
