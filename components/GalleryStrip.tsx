import { galleryItems } from "@/data/site";
import { VisualImage } from "@/components/VisualImage";

export function GalleryStrip() {
  const loopedItems = [...galleryItems, ...galleryItems.slice(0, 6)];

  return (
    <section className="section gallery-preview">
      <div className="gallery-strip" aria-label="Otelden fotoğraflar">
        <div className="gallery-strip__scroller" role="list" tabIndex={0}>
          {loopedItems.map((item, index) => (
            <VisualImage
              key={`${item.image}-${index}`}
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
