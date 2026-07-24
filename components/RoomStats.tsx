export function RoomStats() {
  const stats = [
    ["18", "Oda"],
    ["2", "Suit Oda"],
    ["2", "Aile Odası"],
    ["14", "Standart Oda"]
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
