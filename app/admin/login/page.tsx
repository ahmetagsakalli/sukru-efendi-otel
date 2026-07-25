import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { getAdminAuthState, hasAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Admin Giriş",
  robots: {
    index: false,
    follow: false
  }
};

export default async function AdminLoginPage() {
  if (await hasAdminSession()) {
    redirect("/admin");
  }

  const state = await getAdminAuthState();

  return <AdminAuthScreen mode={state.configured ? "login" : state.setupAllowed ? "setup" : "locked"} />;
}
