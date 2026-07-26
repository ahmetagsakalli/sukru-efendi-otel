import { PublicBookingPage } from "@/components/PublicPages";
import { type BookingSearchParams } from "@/lib/booking-url";
import { getPageMetadata } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

type BookingPageProps = {
  searchParams?: BookingSearchParams;
};

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return getPageMetadata(await getSiteContent(), "en", "booking");
}

export default function EnglishBookingPage({ searchParams }: BookingPageProps) {
  return <PublicBookingPage locale="en" searchParams={searchParams} />;
}
