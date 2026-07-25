import { PublicHistoryPage } from "@/components/PublicPages";
import { getPageMetadata } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

export async function generateMetadata() {
  return getPageMetadata(await getSiteContent(), "en", "history");
}

export default function EnglishHistoryPage() {
  return <PublicHistoryPage locale="en" />;
}
