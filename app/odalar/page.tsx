import type { Metadata } from "next";
import { FeatureHighlights } from "@/components/FeatureHighlights";
import { PageIntro } from "@/components/PageIntro";
import { RoomCard } from "@/components/RoomCard";
import { getSiteContent } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Odalar",
  description: "Şükrü Efendi Ottoman Hotel standart, suit ve aile odaları.",
  alternates: {
    canonical: "/odalar"
  },
  openGraph: {
    title: "Odalar | Şükrü Efendi Ottoman Hotel",
    description: "Ordu merkezde standart, suit ve aile odası seçenekleri.",
    url: "/odalar",
    images: ["/hotel-images/rooms/standard/standard-room-twin.webp"]
  }
};

export default async function RoomsPage() {
  const { pages, roomFeatures, rooms } = await getSiteContent();

  return (
    <div className="page-transition">
      <PageIntro title={pages.rooms.title}>{pages.rooms.body}</PageIntro>
      <section className="section">
        <FeatureHighlights features={roomFeatures} />
        <div className="room-grid room-grid--wide">
          {rooms.map((room) => (
            <RoomCard room={room} key={room.slug} />
          ))}
        </div>
      </section>
    </div>
  );
}
