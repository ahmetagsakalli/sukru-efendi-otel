import { PublicContactPage } from "@/components/PublicPages";
import { getPageMetadata } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

export async function generateMetadata() {
  return getPageMetadata(await getSiteContent(), "en", "contact");
}

export default function EnglishContactPage() {
  return <PublicContactPage locale="en" />;
}
