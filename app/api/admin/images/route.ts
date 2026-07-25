import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPublicDirectory, listPublicImages } from "@/lib/site-content";

export const runtime = "nodejs";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 45_000_000;
const MAX_IMAGE_SIDE = 12_000;
const OUTPUT_MAX_SIDE = 2200;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const ACCEPTED_SHARP_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);

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
    const uploadDirectory = path.join(getPublicDirectory(), "uploads", day);
    await fs.mkdir(uploadDirectory, { recursive: true });

    const filename = `${slugifyFilename(file.name) || "gorsel"}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.webp`;
    const absolutePath = path.join(uploadDirectory, filename);
    temporaryPath = `${absolutePath}.tmp-${process.pid}`;
    const publicPath = `/uploads/${day}/${filename}`;

    await processor
      .resize({ width: OUTPUT_MAX_SIDE, height: OUTPUT_MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toFile(temporaryPath);

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
