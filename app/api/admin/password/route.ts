import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { changeAdminPassword, hasAdminSession, setAdminSession } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(1).max(256)
});

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "local";
}

export async function POST(request: NextRequest) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 401 });
  }

  const rate = checkRateLimit(`admin-password:${getClientKey(request)}`, 5, 15 * 60 * 1000);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  const parsed = passwordChangeSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz parola bilgisi." }, { status: 400 });
  }

  const result = await changeAdminPassword(parsed.data.currentPassword, parsed.data.newPassword);

  if (!result.ok) {
    return NextResponse.json({ error: result.errors.join(" ") }, { status: result.status });
  }

  await setAdminSession();
  console.info("admin_password_changed", { ip: getClientKey(request) });
  return NextResponse.json({ ok: true });
}
