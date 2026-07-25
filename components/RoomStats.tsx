import type { Room } from "@/lib/site-content-schema";

export function RoomStats({ rooms }: { rooms: Room[] }) {
  const totalRooms = rooms.reduce((sum, room) => sum + room.count, 0);
  const suiteRooms = rooms.find((room) => room.tone === "suite")?.count ?? 0;
  const familyRooms = rooms.find((room) => room.tone === "family")?.count ?? 0;
  const standardRooms = rooms.find((room) => room.tone === "room")?.count ?? 0;
  const stats = [
    [String(totalRooms), "Oda"],
    [String(suiteRooms), "Suit Oda"],
    [String(familyRooms), "Aile Odası"],
    [String(standardRooms), "Standart Oda"]
  ];

  return (
    <div className="room-stats" aria-label="Oda sayıları">
      {stats.map(([value, label]) => (
        <div className="room-stats__item" key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
