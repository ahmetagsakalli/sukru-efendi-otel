import { PublicContactPage } from "@/components/PublicPages";
import { getPageMetadata } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

export async function generateMetadata() {
  return getPageMetadata(await getSiteContent(), "de", "contact");
}

export default function GermanContactPage() {
  return <PublicContactPage locale="de" />;
}
