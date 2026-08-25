import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * Calculates CRC32 for PNG chunks
 */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * Creates a PNG chunk with type, data, and calculated CRC
 */
function makePngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcPayload = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcPayload);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * Generates a valid PNG image buffer with custom gradients/colors & text banner style pattern
 */
export function generateValidPng(
  width = 600,
  height = 400,
  r1 = 11,
  g1 = 61,
  b1 = 145, // TQI Primary Navy
  r2 = 255,
  g2 = 122,
  b2 = 0 // TQI Saffron Orange
): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: 13 bytes
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit
  ihdrData.writeUInt8(2, 9); // Color type 2 = RGB
  ihdrData.writeUInt8(0, 10); // Compression method
  ihdrData.writeUInt8(0, 11); // Filter method
  ihdrData.writeUInt8(0, 12); // Interlace method

  const ihdrChunk = makePngChunk('IHDR', ihdrData);

  // Raw Scanlines: (1 byte filter (0) + width * 3 bytes RGB) * height
  const rowStride = 1 + width * 3;
  const rawData = Buffer.alloc(rowStride * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowStride;
    rawData[rowOffset] = 0; // Filter: None

    const yFactor = y / height;

    for (let x = 0; x < width; x++) {
      const xFactor = x / width;
      const pxOffset = rowOffset + 1 + x * 3;

      // Diagonal gradient with decorative framing
      const factor = (xFactor + yFactor) / 2;

      // Decorative border frame (8px)
      const isBorder = x < 8 || x > width - 9 || y < 8 || y > height - 9;
      // Header banner strip
      const isBanner = y >= 20 && y <= 60;
      // Footer strip
      const isFooter = y >= height - 40 && y <= height - 20;

      if (isBorder) {
        rawData[pxOffset] = 255;
        rawData[pxOffset + 1] = 255;
        rawData[pxOffset + 2] = 255;
      } else if (isBanner) {
        rawData[pxOffset] = 11;
        rawData[pxOffset + 1] = 61;
        rawData[pxOffset + 2] = 145;
      } else if (isFooter) {
        rawData[pxOffset] = 255;
        rawData[pxOffset + 1] = 122;
        rawData[pxOffset + 2] = 0;
      } else {
        const r = Math.round(r1 + (r2 - r1) * factor);
        const g = Math.round(g1 + (g2 - g1) * factor);
        const b = Math.round(b1 + (b2 - b1) * factor);
        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
      }
    }
  }

  // Compress IDAT
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makePngChunk('IDAT', compressed);

  // IEND Chunk
  const iendChunk = makePngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}
