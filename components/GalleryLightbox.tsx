"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  defaultLocale,
  getPublicCopy,
  interpolate,
  type PublicLocale
} from "@/lib/i18n";

type GalleryLightboxItem = {
  title: string;
  tone: string;
  image: string;
};

type GalleryLightboxProps = {
  items: readonly GalleryLightboxItem[];
  locale?: PublicLocale;
};

export function GalleryLightbox({ items, locale = defaultLocale }: GalleryLightboxProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const activeItem = activeIndex === null ? null : items[activeIndex];
  const copy = getPublicCopy(locale);

  const close = () => setActiveIndex(null);
  const showPrevious = () =>
    setActiveIndex((index) => (index === null ? index : (index - 1 + items.length) % items.length));
  const showNext = () =>
    setActiveIndex((index) => (index === null ? index : (index + 1) % items.length));

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (activeIndex === null) {
      document.body.classList.remove("lightbox-open");
      return;
    }

    document.body.classList.add("lightbox-open");

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }

      if (event.key === "ArrowLeft") {
        showPrevious();
      }

      if (event.key === "ArrowRight") {
        showNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("lightbox-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex]);

  const lightbox =
    isMounted && activeItem
      ? createPortal(
          <div
            className="gallery-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={activeItem.title}
          >
            <button
              className="gallery-lightbox__backdrop"
              type="button"
              aria-label={copy.gallery.close}
              onClick={close}
            />
            <div className="gallery-lightbox__stage">
              <button
                className="gallery-lightbox__control gallery-lightbox__control--close"
                type="button"
                aria-label={copy.gallery.close}
                onClick={close}
              >
                ×
              </button>
              <button
                className="gallery-lightbox__control gallery-lightbox__control--previous"
                type="button"
                aria-label={copy.gallery.previous}
                onClick={showPrevious}
              >
                ‹
              </button>
              <div className="gallery-lightbox__image-frame">
                <Image
                  src={activeItem.image}
                  alt={activeItem.title}
                  fill
                  sizes="100vw"
                  quality={82}
                  priority
                />
              </div>
              <button
                className="gallery-lightbox__control gallery-lightbox__control--next"
                type="button"
                aria-label={copy.gallery.next}
                onClick={showNext}
              >
                ›
              </button>
              <p className="gallery-lightbox__caption">{activeItem.title}</p>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <section className="section gallery-grid" aria-label={copy.gallery.aria}>
        {items.map((item, index) => (
          <button
            key={item.image}
            className={`gallery-grid__button visual-panel visual-panel--${item.tone}`}
            type="button"
            aria-label={interpolate(copy.gallery.enlarge, { title: item.title })}
            onClick={() => setActiveIndex(index)}
          >
            <Image
              src={item.image}
              alt={item.title}
              fill
              sizes={
                index === 0
                  ? "(max-width: 760px) calc(100vw - 40px), (max-width: 1100px) calc(50vw - 48px), 640px"
                  : "(max-width: 760px) calc(100vw - 40px), (max-width: 1100px) calc(50vw - 48px), 308px"
              }
              quality={72}
            />
          </button>
        ))}
      </section>
      {lightbox}
    </>
  );
}
