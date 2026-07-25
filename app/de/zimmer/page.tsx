import { PublicRoomsPage } from "@/components/PublicPages";
import { getPageMetadata } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

export async function generateMetadata() {
  return getPageMetadata(await getSiteContent(), "de", "rooms");
}

export default function GermanRoomsPage() {
  return <PublicRoomsPage locale="de" />;
}
