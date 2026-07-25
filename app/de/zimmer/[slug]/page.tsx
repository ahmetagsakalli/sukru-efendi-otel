import { notFound } from "next/navigation";
import { PublicRoomDetailPage } from "@/components/PublicPages";
import { getLocalizedRoomSlug, getOriginalRoomSlug, getRoomMetadata } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

type RoomPageProps = {
  params: {
    slug: string;
  };
};

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const { rooms } = await getSiteContent();
  return rooms.map((room) => ({ slug: getLocalizedRoomSlug(room.slug, "de") }));
}

export async function generateMetadata({ params }: RoomPageProps) {
  const originalSlug = getOriginalRoomSlug(params.slug, "de");
  return originalSlug ? getRoomMetadata(await getSiteContent(), "de", originalSlug) : {};
}

export default function GermanRoomDetailPage({ params }: RoomPageProps) {
  const originalSlug = getOriginalRoomSlug(params.slug, "de");

  if (!originalSlug) {
    notFound();
  }

  return <PublicRoomDetailPage locale="de" originalSlug={originalSlug} />;
}
