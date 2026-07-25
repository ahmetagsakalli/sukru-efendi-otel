import { PublicHistoryPage } from "@/components/PublicPages";
import { getPageMetadata } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

export async function generateMetadata() {
  return getPageMetadata(await getSiteContent(), "de", "history");
}

export default function GermanHistoryPage() {
  return <PublicHistoryPage locale="de" />;
}
