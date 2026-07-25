import { VisualImage } from "@/components/VisualImage";
import {
  defaultLocale,
  getPublicCopy,
  type PublicLocale
} from "@/lib/i18n";
import type { GalleryItem } from "@/lib/site-content-schema";

export function GalleryStrip({ items, locale = defaultLocale }: { items: GalleryItem[]; locale?: PublicLocale }) {
  const copy = getPublicCopy(locale);

  return (
    <section className="section gallery-preview">
      <div className="gallery-strip" aria-label={copy.gallery.stripAria}>
        <div className="gallery-strip__scroller" role="list" tabIndex={0}>
          {items.map((item) => (
            <VisualImage
              key={item.image}
              className="gallery-strip__item"
              src={item.image}
              alt={item.title}
              sizes="(max-width: 760px) 75vw, 360px"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
