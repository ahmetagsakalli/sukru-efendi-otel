import { roomFeatures } from "@/data/site";

function FeatureIcon({ icon }: { icon: (typeof roomFeatures)[number]["icon"] }) {
  if (icon === "smart-entry") {
    return (
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <path d="M32 56V33c0-10 8-18 18-18s18 8 18 18v8" />
        <rect x="20" y="50" width="28" height="34" rx="5" />
        <path d="M28 64v9M36 64v9" />
        <circle cx="65" cy="42" r="11" />
        <path d="M73 50l13 13-5 5 4 4-5 5-4-4-5 5-13-13" />
        <path d="M63 40h.1" />
      </svg>
    );
  }

  if (icon === "safe") {
    return (
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <rect x="18" y="16" width="60" height="64" rx="7" />
        <rect x="28" y="26" width="40" height="42" rx="4" />
        <circle cx="48" cy="47" r="10" />
        <path d="M48 32v30M33 47h30M37.5 36.5l21 21M58.5 36.5l-21 21" />
        <path d="M32 80v8M64 80v8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <rect x="25" y="13" width="46" height="70" rx="6" />
      <path d="M35 26h26" />
      <path d="M35 34h26" />
      <path d="M27 18c-5 3-8 8-8 14M77 18c5 3 8 8 8 14" />
      <path d="M32 53c9-8 23-8 32 0" />
      <path d="M38 61c6-5 14-5 20 0" />
      <path d="M45 69c2-2 4-2 6 0" />
      <circle cx="48" cy="74" r="2" />
    </svg>
  );
}

export function FeatureHighlights() {
  return (
    <div className="room-feature-highlights" aria-label="Oda içi önemli detaylar">
      {roomFeatures.map((feature) => (
        <article className="room-feature-highlight" key={feature.title}>
          <FeatureIcon icon={feature.icon} />
          <div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
