import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPublicDirectory, getSiteContent, listPublicImages } from "@/lib/site-content";
import { deleteBlobPath, getBlobMetadata, isBlobStorageEnabled, putPublicBlob } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 45_000_000;
const MAX_IMAGE_SIDE = 12_000;
const OUTPUT_MAX_SIDE = 2200;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const ACCEPTED_SHARP_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);
const uploadPathPattern = /^\/uploads\/[A-Za-z0-9._/-]+\.webp$/;

function slugifyFilename(input: string) {
  const withoutExtension = input.replace(/\.[^.]+$/, "") || "gorsel";
  return withoutExtension
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

async function requireAdmin() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 401 });
  }

  return null;
}

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "local";
}

function collectSavedImageReferences() {
  return getSiteContent().then((content) => {
    const references = new Set<string>();

    references.add(content.pages.home.heroImage);
    references.add(content.pages.home.historyImage);
    references.add(content.pages.history.image);
    content.galleryItems.forEach((item) => references.add(item.image));
    content.rooms.forEach((room) => {
      references.add(room.image);
      room.gallery.forEach((image) => references.add(image));
    });

    return references;
  });
}

function resolveUploadedImagePath(src: string) {
  if (!uploadPathPattern.test(src) || src.includes("..")) {
    return null;
  }

  const publicDirectory = getPublicDirectory();
  const uploadsDirectory = path.resolve(publicDirectory, "uploads");
  const absolutePath = path.resolve(publicDirectory, src.slice(1));

  if (!absolutePath.startsWith(`${uploadsDirectory}${path.sep}`)) {
    return null;
  }

  return {
    absolutePath,
    uploadsDirectory
  };
}

async function removeEmptyUploadDirectories(startDirectory: string, uploadsDirectory: string) {
  let currentDirectory = startDirectory;

  while (currentDirectory.startsWith(uploadsDirectory) && currentDirectory !== uploadsDirectory) {
    const entries = await fs.readdir(currentDirectory).catch(() => null);

    if (!entries || entries.length > 0) {
      return;
    }

    await fs.rmdir(currentDirectory).catch(() => undefined);
    currentDirectory = path.dirname(currentDirectory);
  }
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  return NextResponse.json({ images: await listPublicImages() });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const rate = checkRateLimit(`admin-image-upload:${getClientKey(request)}`, 40, 15 * 60 * 1000);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Çok fazla görsel yüklendi. Biraz sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Görsel bulunamadı." }, { status: 400 });
  }

  if (!ACCEPTED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Sadece jpg, png, avif veya webp yüklenebilir." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "Görsel dosyası boş." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: "Görsel 10 MB sınırını geçmemeli." }, { status: 400 });
  }

  let temporaryPath: string | null = null;

  try {
    const input = Buffer.from(await file.arrayBuffer());
    const processor = sharp(input, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS }).rotate();
    const metadata = await processor.metadata();

    if (!metadata.width || !metadata.height) {
      return NextResponse.json({ error: "Görsel dosyası okunamadı." }, { status: 400 });
    }

    if (!metadata.format || !ACCEPTED_SHARP_FORMATS.has(metadata.format)) {
      return NextResponse.json({ error: "Görsel formatı desteklenmiyor." }, { status: 400 });
    }

    if (metadata.width > MAX_IMAGE_SIDE || metadata.height > MAX_IMAGE_SIDE) {
      return NextResponse.json({ error: "Görsel ölçüleri çok büyük." }, { status: 400 });
    }

    const day = new Date().toISOString().slice(0, 10);
    const filename = `${slugifyFilename(file.name) || "gorsel"}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.webp`;
    const publicPath = `/uploads/${day}/${filename}`;
    const output = await processor
      .resize({ width: OUTPUT_MAX_SIDE, height: OUTPUT_MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toBuffer();

    if (isBlobStorageEnabled()) {
      const uploaded = await putPublicBlob(`uploads/${day}/${filename}`, output, "image/webp");

      if (!uploaded) {
        throw new Error("Blob storage is not configured.");
      }

      return NextResponse.json({
        image: {
          src: publicPath,
          name: filename,
          size: output.length,
          updatedAt: new Date().toISOString()
        }
      });
    }

    const uploadDirectory = path.join(getPublicDirectory(), "uploads", day);
    await fs.mkdir(uploadDirectory, { recursive: true });

    const absolutePath = path.join(uploadDirectory, filename);
    temporaryPath = `${absolutePath}.tmp-${process.pid}`;

    await fs.writeFile(temporaryPath, output);
    await fs.rename(temporaryPath, absolutePath);

    const stat = await fs.stat(absolutePath);

    return NextResponse.json({
      image: {
        src: publicPath,
        name: filename,
        size: stat.size,
        updatedAt: stat.mtime.toISOString()
      }
    });
  } catch (error) {
    if (temporaryPath) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    }

    console.error("admin_image_upload_failed", error);
    return NextResponse.json({ error: "Görsel yüklenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const rate = checkRateLimit(`admin-image-delete:${getClientKey(request)}`, 30, 15 * 60 * 1000);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Çok fazla görsel silme isteği gönderildi. Biraz sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  const body = (await request.json().catch(() => null)) as { src?: unknown } | null;
  const src = typeof body?.src === "string" ? body.src.trim() : "";
  const resolved = resolveUploadedImagePath(src);
  const blobPathname = uploadPathPattern.test(src) && !src.includes("..") ? src.slice(1) : null;

  if (!resolved && !(isBlobStorageEnabled() && blobPathname)) {
    return NextResponse.json({ error: "Sadece panelden yüklenen /uploads altındaki WebP görseller silinebilir." }, { status: 400 });
  }

  const references = await collectSavedImageReferences();

  if (references.has(src)) {
    return NextResponse.json(
      { error: "Bu görsel sitede kullanılıyor. Önce ilgili alanlardan kaldırın veya başka görselle değiştirin." },
      { status: 409 }
    );
  }

  try {
    if (isBlobStorageEnabled() && blobPathname) {
      const metadata = await getBlobMetadata(blobPathname);

      if (!metadata) {
        return NextResponse.json({ error: "Görsel dosyası bulunamadı." }, { status: 404 });
      }

      await deleteBlobPath(blobPathname);
      console.info("admin_image_deleted", { src });

      return NextResponse.json({
        ok: true,
        images: await listPublicImages()
      });
    }

    if (!resolved) {
      return NextResponse.json({ error: "Görsel dosyası bulunamadı." }, { status: 404 });
    }

    const stat = await fs.stat(resolved.absolutePath);

    if (!stat.isFile()) {
      return NextResponse.json({ error: "Görsel dosyası bulunamadı." }, { status: 404 });
    }

    await fs.rm(resolved.absolutePath, { force: true });
    await removeEmptyUploadDirectories(path.dirname(resolved.absolutePath), resolved.uploadsDirectory);

    console.info("admin_image_deleted", { src });

    return NextResponse.json({
      ok: true,
      images: await listPublicImages()
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Görsel dosyası bulunamadı." }, { status: 404 });
    }

    console.error("admin_image_delete_failed", error);
    return NextResponse.json({ error: "Görsel silinemedi." }, { status: 500 });
  }
}
