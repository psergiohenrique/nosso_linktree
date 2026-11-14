"use client";

import { useEffect, useRef, useState } from "react";

/** Botão no topo da página pública: abre o compartilhamento do aparelho ou, sem ele, um menu de opções. */
export default function ShareButton({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.type === "keydown" ? (e as KeyboardEvent).key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const pageUrl = () => window.location.origin + window.location.pathname;

  async function toggle() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url: pageUrl() });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    setOpen((v) => !v);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(pageUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link:", pageUrl());
    }
  }

  function option(network: "whatsapp" | "facebook" | "x" | "linkedin" | "email") {
    const url = encodeURIComponent(pageUrl());
    const text = encodeURIComponent(title);
    const href = {
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      x: `https://x.com/intent/post?text=${text}&url=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      email: `mailto:?subject=${text}&body=${url}`,
    }[network];
    window.open(href, network === "email" ? "_self" : "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  return (
    <div className="bio-share" ref={box}>
      <button type="button" className="bio-share-btn" onClick={toggle} aria-label="Compartilhar esta página" aria-haspopup="menu" aria-expanded={open}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
      </button>
      {open && (
        <div className="bio-share-menu" role="menu">
          <button type="button" role="menuitem" onClick={copy}>{copied ? "Link copiado!" : "Copiar link"}</button>
          <button type="button" role="menuitem" onClick={() => option("whatsapp")}>WhatsApp</button>
          <button type="button" role="menuitem" onClick={() => option("facebook")}>Facebook</button>
          <button type="button" role="menuitem" onClick={() => option("x")}>X</button>
          <button type="button" role="menuitem" onClick={() => option("linkedin")}>LinkedIn</button>
          <button type="button" role="menuitem" onClick={() => option("email")}>E-mail</button>
        </div>
      )}
    </div>
  );
}
