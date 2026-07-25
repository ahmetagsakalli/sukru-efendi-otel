import Link from "next/link";
import { VisualImage } from "@/components/VisualImage";
import {
  defaultLocale,
  getPublicCopy,
  getRoomHref,
  type PublicLocale
} from "@/lib/i18n";
import type { Room } from "@/lib/site-content-schema";

type RoomCardProps = {
  room: Room;
  locale?: PublicLocale;
};

export function RoomCard({ room, locale = defaultLocale }: RoomCardProps) {
  const copy = getPublicCopy(locale);

  return (
    <Link className="room-card" href={getRoomHref(room.slug, locale)}>
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
          <span className="text-link">{copy.rooms.inspect}</span>
        </div>
      </div>
    </Link>
  );
}
