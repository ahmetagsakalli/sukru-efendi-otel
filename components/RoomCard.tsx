import Link from "next/link";
import { VisualImage } from "@/components/VisualImage";
import type { Room } from "@/lib/site-content-schema";

type RoomCardProps = {
  room: Room;
};

export function RoomCard({ room }: RoomCardProps) {
  return (
    <Link className="room-card" href={`/odalar/${room.slug}`}>
      <VisualImage
        className={`visual-panel visual-panel--${room.tone}`}
        src={room.image}
        alt={room.title}
        sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw"
      />
      <div className="room-card__body">
        <h2>{room.title}</h2>
        <p>{room.description}</p>
        <div className="room-card__meta">
          <span>{room.size}</span>
          <span>{room.capacity}</span>
          <span>{room.bed}</span>
        </div>
        <div className="room-card__price">
          <div>
            <strong>{room.price}</strong>
          </div>
          <span className="text-link">İncele</span>
        </div>
      </div>
    </Link>
  );
}
