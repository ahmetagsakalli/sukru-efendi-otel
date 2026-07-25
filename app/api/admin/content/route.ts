import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { hasAdminSession } from "@/lib/admin-auth";
import { getSiteContent, listPublicImages, saveSiteContent } from "@/lib/site-content";

export const runtime = "nodejs";

async function requireAdmin() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 401 });
  }

  return null;
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const [content, images] = await Promise.all([getSiteContent(), listPublicImages()]);
  return NextResponse.json({ content, images });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const content = await saveSiteContent(await request.json());
    return NextResponse.json({ ok: true, content });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "İçerikte eksik veya hatalı alan var.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    console.error("admin_content_save_failed", error);
    return NextResponse.json({ error: "İçerik kaydedilemedi." }, { status: 500 });
  }
}
