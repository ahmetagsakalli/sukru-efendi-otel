import { PublicRoomDetailPage } from "@/components/PublicPages";
import { getRoomMetadata } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

type RoomPageProps = {
  params: {
    slug: string;
  };
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: RoomPageProps) {
  return getRoomMetadata(await getSiteContent(), "tr", params.slug);
}

export default function RoomDetailPage({ params }: RoomPageProps) {
  return <PublicRoomDetailPage locale="tr" originalSlug={params.slug} />;
}
