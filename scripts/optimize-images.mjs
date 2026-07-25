import { readdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const publicDir = path.join(process.cwd(), "public");
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

async function collectImages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectImages(entryPath);
      }

      if (entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase())) {
        return [entryPath];
      }

      return [];
    })
  );

  return files.flat();
}

async function optimizeImage(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const outputPath = filePath.replace(/\.(jpe?g|png|webp)$/i, ".webp");
  const temporaryPath = `${outputPath}.tmp`;
  const metadata = await sharp(filePath).metadata();
  const isTransparentGraphic = extension === ".png" && Boolean(metadata.hasAlpha);
  const before = (await stat(filePath)).size;

  await sharp(filePath)
    .rotate()
    .webp(isTransparentGraphic ? { lossless: true, effort: 6 } : { quality: 82, effort: 6 })
    .toFile(temporaryPath);

  await rename(temporaryPath, outputPath);

  if (filePath !== outputPath) {
    await unlink(filePath);
  }

  const after = (await stat(outputPath)).size;
  const relativePath = path.relative(process.cwd(), outputPath);

  return { relativePath, before, after };
}

const images = await collectImages(publicDir);
const results = [];

for (const image of images) {
  results.push(await optimizeImage(image));
}

const beforeTotal = results.reduce((total, result) => total + result.before, 0);
const afterTotal = results.reduce((total, result) => total + result.after, 0);
const saved = beforeTotal - afterTotal;

for (const result of results) {
  console.log(`${result.relativePath} ${result.before} -> ${result.after}`);
}

console.log(
  `Optimized ${results.length} images. Saved ${Math.max(saved, 0)} bytes.`
);
