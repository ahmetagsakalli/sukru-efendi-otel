import type { Metadata } from "next";
import { FeatureHighlights } from "@/components/FeatureHighlights";
import { PageIntro } from "@/components/PageIntro";
import { RoomCard } from "@/components/RoomCard";
import { rooms } from "@/data/site";

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
    images: ["/hotel-images/rooms/standard/standard-room-twin.jpg"]
  }
};

export default function RoomsPage() {
  return (
    <div className="page-transition">
      <PageIntro title="Şehrin merkezinde, ihtiyaca göre seçilen odalar.">
        Her oda yalın bir konfor anlayışıyla hazırlandı. Kısa konaklama, iş seyahati veya aile
        ziyareti için farklı kullanım biçimleri düşünülür.
      </PageIntro>
      <section className="section">
        <FeatureHighlights />
        <div className="room-grid room-grid--wide">
          {rooms.map((room) => (
            <RoomCard room={room} key={room.slug} />
          ))}
        </div>
      </section>
    </div>
  );
}
