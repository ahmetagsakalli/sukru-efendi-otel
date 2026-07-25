import { VisualImage } from "@/components/VisualImage";
import type { GalleryItem } from "@/lib/site-content-schema";

export function GalleryStrip({ items }: { items: GalleryItem[] }) {
  return (
    <section className="section gallery-preview">
      <div className="gallery-strip" aria-label="Otelden fotoğraflar">
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
