import { PublicHomePage } from "@/components/PublicPages";
import { getPageMetadata } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

export async function generateMetadata() {
  return getPageMetadata(await getSiteContent(), "en", "home");
}

export default function EnglishHomePage() {
  return <PublicHomePage locale="en" />;
}
