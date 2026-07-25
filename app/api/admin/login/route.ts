import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setAdminSession, verifyAdminPassword } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const loginSchema = z.object({
  password: z.string().min(1).max(256)
});

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "local";
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`admin-login:${getClientKey(request)}`, 8, 15 * 60 * 1000);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz giriş." }, { status: 400 });
  }

  const isValid = await verifyAdminPassword(parsed.data.password);

  if (!isValid) {
    console.warn("admin_login_failed", { ip: getClientKey(request) });
    return NextResponse.json({ error: "Parola hatalı." }, { status: 401 });
  }

  await setAdminSession();
  console.info("admin_login_success", { ip: getClientKey(request) });
  return NextResponse.json({ ok: true });
}
