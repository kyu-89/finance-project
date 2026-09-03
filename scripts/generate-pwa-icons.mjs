import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const source = path.join(projectRoot, 'ChatGPT Image 2026년 9월 3일 오전 11_01_14 (2).png');
const publicDir = path.join(projectRoot, 'public');

// The supplied master is a 3:2 presentation canvas. Its icon artwork is the
// centered square, so all platform assets use the same centered crop and only
// change pixel dimensions/encoding.
const master = sharp(source).extract({ left: 256, top: 0, width: 1024, height: 1024 });
const png = async (size) => master.clone().resize(size, size, { fit: 'cover' }).png().toBuffer();

await fs.mkdir(publicDir, { recursive: true });
const assets = new Map([
  ['app-icon.png', 1024],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-192-maskable.png', 192],
  ['icon-512-maskable.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-16x16.png', 16],
  ['favicon-32x32.png', 32],
]);

for (const [name, size] of assets) await fs.writeFile(path.join(publicDir, name), await png(size));

// ICO files can contain PNG payloads. Keeping both sizes in the container
// gives desktop browsers a crisp choice without another image dependency.
const icoImages = [await png(16), await png(32)];
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoImages.length, 4);
let offset = 6 + icoImages.length * 16;
const entries = icoImages.map((image, index) => {
  const entry = Buffer.alloc(16);
  const size = index === 0 ? 16 : 32;
  entry.writeUInt8(size, 0);
  entry.writeUInt8(size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(image.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += image.length;
  return entry;
});
await fs.writeFile(path.join(publicDir, 'favicon.ico'), Buffer.concat([header, ...entries, ...icoImages]));
