"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/odalar", label: "ODALAR" },
  { href: "/#hizmetler", label: "HİZMETLER" },
  { href: "/tarihce", label: "TARİHÇE" },
  { href: "/galeri", label: "GALERİ" },
  { href: "/iletisim", label: "İLETİŞİM" }
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("menu-open", isOpen);
    return () => document.body.classList.remove("menu-open");
  }, [isOpen]);

  return (
    <>
      <header className="site-header">
        <Link className="brand-mark" aria-label="Ana sayfa" href="/">
          <Image
            src="/brand/sukru-efendi-logo.png"
            alt="Şükrü Efendi Ottoman Hotel"
            width={176}
            height={115}
            className="brand-logo"
            priority
            unoptimized
          />
        </Link>
        <div className="site-header__panel">
          <nav className="main-nav" aria-label="Ana menü">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <Link className="booking-link booking-link--solid site-header__booking" href="/iletisim">
            REZERVASYON YAP
          </Link>
        </div>
        <div className="mobile-header-menu">
          <button
            className={`mobile-menu-toggle${isOpen ? " is-open" : ""}`}
            type="button"
            aria-label={isOpen ? "Menüyü kapat" : "Menüyü aç"}
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
        aria-label="Mobil menü"
        hidden={!isOpen}
      >
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
            {item.label}
          </Link>
        ))}
        <Link
          className="booking-link booking-link--solid"
          href="/iletisim"
          onClick={() => setIsOpen(false)}
        >
          REZERVASYON YAP
        </Link>
      </nav>
    </>
  );
}
