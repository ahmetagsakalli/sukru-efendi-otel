import {
  defaultLocale,
  getPublicCopy,
  type PublicLocale
} from "@/lib/i18n";
import type { Room } from "@/lib/site-content-schema";

export function RoomStats({ rooms, locale = defaultLocale }: { rooms: Room[]; locale?: PublicLocale }) {
  const copy = getPublicCopy(locale);
  const totalRooms = rooms.reduce((sum, room) => sum + room.count, 0);
  const suiteRooms = rooms.find((room) => room.tone === "suite")?.count ?? 0;
  const familyRooms = rooms.find((room) => room.tone === "family")?.count ?? 0;
  const standardRooms = rooms.find((room) => room.tone === "room")?.count ?? 0;
  const stats = [
    [String(totalRooms), copy.rooms.totalRooms],
    [String(suiteRooms), copy.rooms.suiteRooms],
    [String(familyRooms), copy.rooms.familyRooms],
    [String(standardRooms), copy.rooms.standardRooms]
  ];

  return (
    <div className="room-stats" aria-label={copy.rooms.statsAria}>
      {stats.map(([value, label]) => (
        <div className="room-stats__item" key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
