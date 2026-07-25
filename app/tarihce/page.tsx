import type { Metadata } from "next";
import { PageIntro } from "@/components/PageIntro";
import { VisualImage } from "@/components/VisualImage";
import { getSiteContent } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Tarihçe",
  description: "Şükrü Efendi Ottoman Hotel tarihi yapısı ve korunmuş atmosferi.",
  alternates: {
    canonical: "/tarihce"
  },
  openGraph: {
    title: "Tarihçe | Şükrü Efendi Ottoman Hotel",
    description: "Otelin tarihi yapısına ve korunmuş atmosferine kısa bakış.",
    url: "/tarihce",
    images: ["/hotel-images/facade-night-wide.webp"]
  }
};

export default async function HistoryPage() {
  const { pages, site } = await getSiteContent();

  return (
    <div className="page-transition">
      <PageIntro title={pages.history.title}>{pages.history.body}</PageIntro>
      <section className="section split-feature">
        <VisualImage
          className="visual-panel visual-panel--facade"
          src={pages.history.image}
          alt={`${site.name} tarihi cephe`}
          sizes="(max-width: 760px) 100vw, 50vw"
        />
        <div className="timeline">
          {pages.history.timeline.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
