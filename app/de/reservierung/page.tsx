import { PublicBookingPage } from "@/components/PublicPages";
import { type BookingSearchParams } from "@/lib/booking-url";
import { getPageMetadata } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

type BookingPageProps = {
  searchParams?: BookingSearchParams;
};

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return getPageMetadata(await getSiteContent(), "de", "booking");
}

export default function GermanBookingPage({ searchParams }: BookingPageProps) {
  return <PublicBookingPage locale="de" searchParams={searchParams} />;
}
