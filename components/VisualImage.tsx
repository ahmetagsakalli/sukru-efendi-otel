import Image from "next/image";

type VisualImageProps = {
  src: string;
  alt: string;
  className: string;
  priority?: boolean;
  sizes?: string;
};

export function VisualImage({
  src,
  alt,
  className,
  priority = false,
  sizes = "100vw"
}: VisualImageProps) {
  return (
    <figure className={className}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        unoptimized
      />
    </figure>
  );
}
