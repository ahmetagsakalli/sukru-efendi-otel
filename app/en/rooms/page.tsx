import { PublicRoomsPage } from "@/components/PublicPages";
import { getPageMetadata } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

export async function generateMetadata() {
  return getPageMetadata(await getSiteContent(), "en", "rooms");
}

export default function EnglishRoomsPage() {
  return <PublicRoomsPage locale="en" />;
}
