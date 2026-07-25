import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getPublicDirectory } from "@/lib/site-content";
import { readPublicBlob } from "@/lib/storage";

export const runtime = "nodejs";

function isSafeSegment(segment: string) {
  return Boolean(segment) && !segment.includes("..") && !segment.includes("/") && !segment.includes("\\");
}

export async function GET(_request: Request, { params }: { params: { path: string[] } }) {
  const segments = params.path ?? [];
  const filename = segments.at(-1) ?? "";

  if (segments.length < 2 || !segments.every(isSafeSegment) || !filename.toLowerCase().endsWith(".webp")) {
    return NextResponse.json({ error: "Görsel bulunamadı." }, { status: 404 });
  }

  const uploadsRoot = path.resolve(getPublicDirectory(), "uploads");
  const requestedPath = path.resolve(uploadsRoot, ...segments);

  if (!requestedPath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return NextResponse.json({ error: "Görsel bulunamadı." }, { status: 404 });
  }

  try {
    const buffer = await fs.readFile(requestedPath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "image/webp"
      }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const blob = await readPublicBlob(`uploads/${segments.join("/")}`);

      if (!blob) {
        return NextResponse.json({ error: "Görsel bulunamadı." }, { status: 404 });
      }

      return new NextResponse(new Uint8Array(blob.body), {
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Length": String(blob.size),
          "Content-Type": blob.contentType || "image/webp"
        }
      });
    }

    console.error("uploaded_image_read_failed", error);
    return NextResponse.json({ error: "Görsel okunamadı." }, { status: 500 });
  }
}
