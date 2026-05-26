import sharp from 'sharp';
import { readdir, stat, rename, unlink } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(import.meta.url), '..', 'assets');
const QUALITY = 80;
const EXTS = new Set(['.jpg', '.jpeg', '.png']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(full));
    else if (EXTS.has(extname(e.name).toLowerCase())) files.push(full);
  }
  return files;
}

async function compress(file) {
  const ext = extname(file).toLowerCase();
  const outPath = file.replace(/\.(jpg|jpeg|png)$/i, '.webp');

  const beforeStat = await stat(file);
  const beforeKB = Math.round(beforeStat.size / 1024);

  try {
    await sharp(file)
      .webp({ quality: QUALITY })
      .toFile(outPath);

    const afterStat = await stat(outPath);
    const afterKB = Math.round(afterStat.size / 1024);
    const saved = Math.round((1 - afterStat.size / beforeStat.size) * 100);

    // Replace original with webp (same filename, new extension)
    await unlink(file);

    return { file, beforeKB, afterKB, saved };
  } catch (err) {
    console.error(`  SKIP ${basename(file)}: ${err.message}`);
    return null;
  }
}

const files = await walk(ROOT);
console.log(`Found ${files.length} images. Compressing to WebP at quality ${QUALITY}...\n`);

let totalBefore = 0, totalAfter = 0, done = 0;

for (const file of files) {
  const result = await compress(file);
  if (!result) continue;
  totalBefore += result.beforeKB;
  totalAfter  += result.afterKB;
  done++;
  process.stdout.write(`\r  ${done}/${files.length}  (${Math.round(totalBefore/1024)}MB → ${Math.round(totalAfter/1024)}MB saved)`);
}

console.log(`\n\nDone! ${done} files compressed.`);
console.log(`Before: ${Math.round(totalBefore / 1024)} MB`);
console.log(`After:  ${Math.round(totalAfter  / 1024)} MB`);
console.log(`Saved:  ${Math.round((1 - totalAfter/totalBefore)*100)}%`);
console.log(`\nNext: update image paths in projects-data.js (.png/.jpg → .webp)`);
