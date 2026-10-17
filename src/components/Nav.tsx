"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "./Logo";

const LINKS = [
  { id: "recursos", label: "Recursos" },
  { id: "como-funciona", label: "Como funciona" },
  { id: "planos", label: "Planos" },
  { id: "comecar", label: "Começar" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`nav ${scrolled ? "scrolled" : ""}`}>
      <div className="nav-inner">
        <Logo href="#hero" />

        <div className="nav-links">
          {LINKS.map((link) => (
            <a key={link.id} href={`#${link.id}`} className="navlink">
              {link.label}
            </a>
          ))}
        </div>

        <div className="nav-actions">
          <Link href="/login" className="btn btn-outline btn-sm">
            Entrar
          </Link>
          <Link href="/login?modo=cadastro" className="btn btn-primary btn-sm">
            Criar página
          </Link>
        </div>
      </div>
    </nav>
  );
}
