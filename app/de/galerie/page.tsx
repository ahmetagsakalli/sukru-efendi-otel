import { PublicGalleryPage } from "@/components/PublicPages";
import { getPageMetadata } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

export async function generateMetadata() {
  return getPageMetadata(await getSiteContent(), "de", "gallery");
}

export default function GermanGalleryPage() {
  return <PublicGalleryPage locale="de" />;
}
