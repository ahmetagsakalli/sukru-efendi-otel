"use client";

import { useEffect, useState } from "react";

type HeroServiceRotatorProps = {
  items: string[];
  label?: string;
};

export function HeroServiceRotator({ items, label }: HeroServiceRotatorProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % items.length);
    }, 2400);

    return () => window.clearInterval(timer);
  }, [items.length]);

  return (
    <div className="hero-service-rotator" id="hizmetler" aria-label={label ?? `Otel hizmetleri: ${items.join(", ")}`}>
      <span className="hero-service-rotator__text" aria-hidden="true">
        {items[index]}
      </span>
      <span className="hero-service-rotator__cursor" aria-hidden="true" />
    </div>
  );
}
