import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLocalAdminAuth, setAdminSession } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const setupSchema = z.object({
  password: z.string().min(1).max(256)
});

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "local";
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`admin-setup:${getClientKey(request)}`, 5, 15 * 60 * 1000);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  const parsed = setupSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz parola." }, { status: 400 });
  }

  const result = await createLocalAdminAuth(parsed.data.password);

  if (!result.ok) {
    return NextResponse.json({ error: result.errors.join(" ") }, { status: 400 });
  }

  await setAdminSession();
  console.info("admin_setup_created", { ip: getClientKey(request) });
  return NextResponse.json({ ok: true });
}
