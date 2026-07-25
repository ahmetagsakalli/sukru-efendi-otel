import { PublicGalleryPage } from "@/components/PublicPages";
import { getPageMetadata } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

export async function generateMetadata() {
  return getPageMetadata(await getSiteContent(), "en", "gallery");
}

export default function EnglishGalleryPage() {
  return <PublicGalleryPage locale="en" />;
}
