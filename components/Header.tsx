"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  defaultLocale,
  getBookingHref,
  getHomeHref,
  getLanguageSwitchHref,
  getPublicCopy,
  getRouteHref,
  getServicesHref,
  localeLabels,
  publicLocales,
  type PublicLocale
} from "@/lib/i18n";

export function Header({ locale = defaultLocale }: { locale?: PublicLocale }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const pathname = usePathname() ?? getHomeHref(locale);
  const copy = getPublicCopy(locale);
  const navItems = [
    { href: getRouteHref(locale, "rooms"), label: copy.nav.rooms },
    { href: getServicesHref(locale), label: copy.nav.services },
    { href: getRouteHref(locale, "history"), label: copy.nav.history },
    { href: getRouteHref(locale, "gallery"), label: copy.nav.gallery },
    { href: getRouteHref(locale, "contact"), label: copy.nav.contact }
  ];
  const languageAria =
    locale === "en" ? "Language selector" : locale === "de" ? "Sprachauswahl" : "Dil seçimi";

  useEffect(() => {
    document.body.classList.toggle("menu-open", isOpen);
    return () => document.body.classList.remove("menu-open");
  }, [isOpen]);

  useEffect(() => {
    setIsLanguageOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isLanguageOpen) return undefined;

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Element && event.target.closest(".language-select")) return;
      setIsLanguageOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsLanguageOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLanguageOpen]);

  function renderLanguageSelect(isMobile = false) {
    const id = isMobile ? "mobile-language-menu" : "desktop-language-menu";

    return (
      <div className={`language-select${isLanguageOpen ? " is-open" : ""}${isMobile ? " language-select--mobile" : ""}`}>
        <button
          className="language-select__trigger"
          type="button"
          aria-label={languageAria}
          aria-controls={id}
          aria-expanded={isLanguageOpen}
          aria-haspopup="menu"
          onClick={() => setIsLanguageOpen((value) => !value)}
        >
          <span>{localeLabels[locale].short}</span>
          <ChevronDown aria-hidden="true" className="language-select__icon" size={15} strokeWidth={2.2} />
        </button>
        <div id={id} className="language-select__menu" role="menu" hidden={!isLanguageOpen}>
          {publicLocales.map((item) => (
            <Link
              key={item}
              href={getLanguageSwitchHref(pathname, item)}
              aria-current={item === locale ? "true" : undefined}
              aria-label={localeLabels[item].aria}
              role="menuitem"
              onClick={() => {
                setIsLanguageOpen(false);
                if (isMobile) setIsOpen(false);
              }}
            >
              <span className="language-select__code">{localeLabels[item].short}</span>
              <span className="language-select__native">{localeLabels[item].native}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="site-header">
        <Link className="brand-mark" aria-label={copy.nav.home} href={getHomeHref(locale)}>
          <Image
            src="/brand/sukru-efendi-logo.webp"
            alt="Şükrü Efendi Ottoman Hotel"
            width={176}
            height={115}
            className="brand-logo"
            priority
          />
        </Link>
        <div className="site-header__panel">
          <nav className="main-nav" aria-label={copy.nav.mainMenu}>
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          {renderLanguageSelect()}
          <Link className="booking-link booking-link--solid site-header__booking" href={getBookingHref(locale)}>
            {copy.nav.booking}
          </Link>
        </div>
        <div className="mobile-header-menu">
          <button
            className={`mobile-menu-toggle${isOpen ? " is-open" : ""}`}
            type="button"
            aria-label={isOpen ? copy.nav.closeMenu : copy.nav.openMenu}
            aria-controls="mobile-navigation"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>
      <nav
        id="mobile-navigation"
        className={`static-mobile-nav${isOpen ? " is-open" : ""}`}
        aria-label={copy.nav.mobileMenu}
        hidden={!isOpen}
      >
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
            {item.label}
          </Link>
        ))}
        <Link
          className="booking-link booking-link--solid"
          href={getBookingHref(locale)}
          onClick={() => setIsOpen(false)}
        >
          {copy.nav.booking}
        </Link>
        {renderLanguageSelect(true)}
      </nav>
    </>
  );
}
