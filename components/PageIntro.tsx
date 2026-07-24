import type { ReactNode } from "react";

type PageIntroProps = {
  title: string;
  children: ReactNode;
};

export function PageIntro({ title, children }: PageIntroProps) {
  return (
    <section className="page-intro">
      <p className="page-intro__kicker">Şükrü Efendi Ottoman Hotel</p>
      <h1>{title}</h1>
      <p>{children}</p>
    </section>
  );
}
