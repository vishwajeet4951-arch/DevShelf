import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Standard CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function calculateCrc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crcTarget = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = calculateCrc32(crcTarget);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function createPng(width, height, drawFn) {
  // 1. Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // 2. IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // Compression deflate
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace none
  const ihdrChunk = createChunk('IHDR', ihdr);

  // 3. IDAT Chunk: Raw scanlines with 0 filter byte prefix
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    scanlines[offset++] = 0; // Filter byte 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      scanlines[offset++] = r;
      scanlines[offset++] = g;
      scanlines[offset++] = b;
      scanlines[offset++] = a;
    }
  }

  const compressedData = zlib.deflateSync(scanlines, { level: 9 });
  const idatChunk = createChunk('IDAT', compressedData);

  // 4. IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Draws the DevShelf logo:
 * Dark rounded rectangle with code brackets < / >
 */
function drawDevShelfIcon(x, y, width, height, isMaskable = false) {
  const normX = x / width;
  const normY = y / height;

  // Background
  const bgR = 15, bgG = 18, bgB = 25; // #0f1219

  if (!isMaskable) {
    // Check rounded corners for standalone icon
    const radius = 0.22;
    let inRoundedRect = true;
    const checkCorner = (cx, cy) => {
      const dx = Math.abs(normX - cx);
      const dy = Math.abs(normY - cy);
      if (dx < radius && dy < radius) {
        const dist = Math.sqrt((radius - dx) ** 2 + (radius - dy) ** 2);
        return dist <= radius;
      }
      return true;
    };

    if (normX < radius && normY < radius && !checkCorner(radius, radius)) inRoundedRect = false;
    if (normX > 1 - radius && normY < radius && !checkCorner(1 - radius, radius)) inRoundedRect = false;
    if (normX < radius && normY > 1 - radius && !checkCorner(radius, 1 - radius)) inRoundedRect = false;
    if (normX > 1 - radius && normY > 1 - radius && !checkCorner(1 - radius, 1 - radius)) inRoundedRect = false;

    if (!inRoundedRect) {
      return [0, 0, 0, 0]; // Transparent outside
    }
  }

  // Bracket thickness and coordinates
  const scale = isMaskable ? 0.7 : 0.85;
  const centerX = 0.5;
  const centerY = 0.5;

  const adjX = (normX - centerX) / scale + 0.5;
  const adjY = (normY - centerY) / scale + 0.5;

  // Function to calculate distance from point (x, y) to line segment (x1, y1) -> (x2, y2)
  function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((px - (x1 + t * (x2 - x1))) ** 2 + (py - (y1 + t * (y2 - y1))) ** 2);
  }

  const strokeWidth = 0.055;

  // Left bracket (<): (0.33, 0.32) -> (0.20, 0.50) -> (0.33, 0.68)
  const dLeft1 = distToSegment(adjX, adjY, 0.33, 0.32, 0.20, 0.50);
  const dLeft2 = distToSegment(adjX, adjY, 0.20, 0.50, 0.33, 0.68);
  const dLeft = Math.min(dLeft1, dLeft2);

  // Right bracket (>): (0.67, 0.32) -> (0.80, 0.50) -> (0.67, 0.68)
  const dRight1 = distToSegment(adjX, adjY, 0.67, 0.32, 0.80, 0.50);
  const dRight2 = distToSegment(adjX, adjY, 0.80, 0.50, 0.67, 0.68);
  const dRight = Math.min(dRight1, dRight2);

  // Center slash (/): (0.57, 0.28) -> (0.43, 0.72)
  const dSlash = distToSegment(adjX, adjY, 0.57, 0.28, 0.43, 0.72);

  // Antialiased stroke blending
  const aaEdge = 0.012;

  // Left bracket (#6366f1: 99, 102, 241)
  if (dLeft < strokeWidth + aaEdge) {
    const alpha = Math.max(0, Math.min(1, (strokeWidth + aaEdge - dLeft) / aaEdge));
    return [99, 102, 241, Math.round(alpha * 255)];
  }

  // Right bracket (#38bdf8: 56, 189, 248)
  if (dRight < strokeWidth + aaEdge) {
    const alpha = Math.max(0, Math.min(1, (strokeWidth + aaEdge - dRight) / aaEdge));
    return [56, 189, 248, Math.round(alpha * 255)];
  }

  // Slash (#64748b: 100, 116, 139)
  if (dSlash < strokeWidth * 0.75 + aaEdge) {
    const alpha = Math.max(0, Math.min(1, (strokeWidth * 0.75 + aaEdge - dSlash) / aaEdge));
    return [100, 116, 139, Math.round(alpha * 255)];
  }

  return [bgR, bgG, bgB, 255];
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate Icons
console.log('Generating PNG icons for PWA...');

const icon192 = createPng(192, 192, (x, y, w, h) => drawDevShelfIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), icon192);
console.log('✓ Created public/pwa-192x192.png');

const icon512 = createPng(512, 512, (x, y, w, h) => drawDevShelfIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), icon512);
console.log('✓ Created public/pwa-512x512.png');

const maskable512 = createPng(512, 512, (x, y, w, h) => drawDevShelfIcon(x, y, w, h, true));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), maskable512);
console.log('✓ Created public/pwa-maskable-512x512.png');

const appleTouch = createPng(180, 180, (x, y, w, h) => drawDevShelfIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouch);
console.log('✓ Created public/apple-touch-icon.png');

console.log('All PWA icons generated successfully!');
