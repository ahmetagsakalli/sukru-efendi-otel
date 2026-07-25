"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  defaultLocale,
  getBookingHref,
  getHomeHref,
  getLocaleFromPathname,
  getPublicCopy,
  getRouteHref,
  getServicesHref,
  localizeSiteContent,
  type PublicLocale
} from "@/lib/i18n";
import type { SiteContent } from "@/lib/site-content-schema";

export function Footer({ content: baseContent, locale = defaultLocale }: { content: SiteContent; locale?: PublicLocale }) {
  const pathname = usePathname() ?? getHomeHref(locale);
  const activeLocale = getLocaleFromPathname(pathname);
  const content = localizeSiteContent(baseContent, activeLocale);
  const { site } = content;
  const copy = getPublicCopy(activeLocale);
  const navItems = [
    { href: getRouteHref(activeLocale, "rooms"), label: copy.nav.rooms },
    { href: getServicesHref(activeLocale), label: copy.nav.services },
    { href: getRouteHref(activeLocale, "history"), label: copy.nav.history },
    { href: getRouteHref(activeLocale, "gallery"), label: copy.nav.gallery },
    { href: getRouteHref(activeLocale, "contact"), label: copy.nav.contact }
  ];

  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div>
          <p className="footer-kicker">{site.name}</p>
          <p className="footer-title">{copy.footer.title}</p>
        </div>
        <div className="footer-links">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
        <div className="footer-contact">
          <a href={site.phoneHref}>{site.phone}</a>
          <a href={site.emailHref}>{site.email}</a>
          <a href={site.mapHref} target="_blank" rel="noreferrer">
            {copy.footer.openMap}
          </a>
          <Link className="booking-link booking-link--outline" href={getBookingHref(activeLocale)}>
            {copy.nav.booking}
          </Link>
        </div>
      </div>
      <div className="footer-location">
        <div className="footer-location__copy">
          <p className="footer-kicker">{copy.footer.locationKicker}</p>
          <h2>{copy.footer.locationTitle}</h2>
          <address>{site.address}</address>
          <a className="text-link" href={site.mapHref} target="_blank" rel="noreferrer">
            {copy.footer.openMap}
          </a>
        </div>
        <div className="footer-map" aria-label={copy.footer.mapAria}>
          <iframe
            title={copy.contact.mapTitle}
            src={site.mapEmbed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>
    </footer>
  );
}
