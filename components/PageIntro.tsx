import type { ReactNode } from "react";

type PageIntroProps = {
  children: ReactNode;
  kicker?: string;
  title: string;
};

export function PageIntro({ kicker = "Şükrü Efendi Ottoman Hotel", title, children }: PageIntroProps) {
  return (
    <section className="page-intro">
      {kicker ? <p className="page-intro__kicker">{kicker}</p> : null}
      <h1>{title}</h1>
      <p>{children}</p>
    </section>
  );
}
