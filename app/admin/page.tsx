import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { hasAdminSession } from "@/lib/admin-auth";
import { getHotelCenterData } from "@/lib/hotel-center";
import { listReservationRequests } from "@/lib/reservations";
import { getSiteContent, listPublicImages } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Yönetim Paneli",
  robots: {
    index: false,
    follow: false
  }
};

export default async function AdminPage() {
  if (!(await hasAdminSession())) {
    redirect("/admin/login");
  }

  const [content, images, reservations] = await Promise.all([
    getSiteContent(),
    listPublicImages(),
    listReservationRequests()
  ]);
  const hotelCenter = await getHotelCenterData(content);

  return (
    <AdminDashboard
      initialContent={content}
      initialHotelCenter={hotelCenter}
      initialImages={images}
      initialReservations={reservations}
    />
  );
}
