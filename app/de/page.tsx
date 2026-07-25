import { PublicHomePage } from "@/components/PublicPages";
import { getPageMetadata } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

export async function generateMetadata() {
  return getPageMetadata(await getSiteContent(), "de", "home");
}

export default function GermanHomePage() {
  return <PublicHomePage locale="de" />;
}
