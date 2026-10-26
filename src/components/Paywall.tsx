"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { subscribePro } from "@/app/dashboard/actions";
import { PRO_PRICES, formatBRL } from "@/lib/billing";
import { PAYWALL, PAYWALL_PRO_LIST, type PaywallFeature } from "@/lib/paywall";
import { THEME_PRESETS, WHATSAPP_DEFAULT } from "@/lib/types";
import PageView, { type PageViewLink, type PageViewProfile } from "./PageView";

/**
 * Aviso de recurso Pro. Qualquer tela do painel chama openPaywall("featured") quando a pessoa
 * no Grátis tenta usar algo do Pro; o PaywallDialog (montado uma vez no layout do painel, só no
 * Grátis com a cobrança ligada) mostra o recurso, os preços e o botão que abre o checkout.
 */

const EVENT = "linkbio:paywall";

type Detail = { feature: PaywallFeature; onClose?: () => void };

export function openPaywall(feature: PaywallFeature, onClose?: () => void) {
  window.dispatchEvent(new CustomEvent<Detail>(EVENT, { detail: { feature, onClose } }));
}

/** Botão que, em vez de agir, abre o aviso do Pro. */
export function PaywallButton({
  feature,
  className = "btn btn-primary btn-sm",
  children,
}: {
  feature: PaywallFeature;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className={className} onClick={() => openPaywall(feature)}>
      {children}
    </button>
  );
}

const SAMPLE_PROFILE: PageViewProfile = {
  ...THEME_PRESETS[2].appearance,
  ...WHATSAPP_DEFAULT,
  slug: "sua-pagina",
  display_name: "Sua página",
  bio: "",
  avatar_url: "/demo/avatar.svg",
  cover_image_url: null,
};

const SAMPLE_LINKS: Record<"featured" | "tile", PageViewLink[]> = {
  featured: [
    { id: "f1", kind: "link", title: "Promoção da semana", url: "#", thumbnail_url: "/demo/precos.svg", layout: "featured", size: "md" },
    { id: "f2", kind: "whatsapp", title: "Pedir pelo WhatsApp", url: "#", thumbnail_url: null, layout: "button", size: "md" },
  ],
  tile: [
    { id: "t1", kind: "link", title: "Como chegar", url: "#", thumbnail_url: "/demo/mapa.svg", layout: "tile", size: "md" },
    { id: "t2", kind: "link", title: "Instagram", url: "#", thumbnail_url: "/demo/insta.svg", layout: "tile", size: "md" },
    { id: "t3", kind: "whatsapp", title: "Pedir pelo WhatsApp", url: "#", thumbnail_url: null, layout: "button", size: "md" },
  ],
};

const { monthly, yearly } = PRO_PRICES;
const yearlyPerMonth = formatBRL(yearly.cents / 12);

export function PaywallDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState<Detail | null>(null);

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<Detail>).detail;
      setCurrent(detail);
      ref.current?.showModal();
      if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) posthog.capture("paywall_viewed", { feature: detail.feature });
    }
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);

  const feature = current?.feature;
  const copy = feature ? PAYWALL[feature] : null;

  return (
    <dialog
      ref={ref}
      className="paywall"
      aria-labelledby="paywall-title"
      onClose={() => {
        current?.onClose?.();
        setCurrent(null);
      }}
      // Clique fora do cartão fecha.
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      {copy && feature && (
        <div className="paywall-body">
          <button type="button" className="paywall-close" aria-label="Fechar" onClick={() => ref.current?.close()}>
            ×
          </button>

          {(feature === "featured" || feature === "tile") && (
            <div className="paywall-preview" aria-hidden="true">
              <div className="paywall-phone">
                <PageView profile={SAMPLE_PROFILE} links={SAMPLE_LINKS[feature]} tracked={false} preview branding={false} />
              </div>
            </div>
          )}

          <div className="paywall-content">
            <span className="pro-tag paywall-tag">Pro</span>
            <h2 id="paywall-title" className="paywall-title">
              {copy.title}
            </h2>
            <p className="paywall-text">{copy.text}</p>
            <ul className="paywall-list">
              {PAYWALL_PRO_LIST.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <div className="paywall-plans">
              <form action={subscribePro} data-posthog-event="pro_checkout_started" data-posthog-cycle="yearly">
                <input type="hidden" name="cycle" value="yearly" />
                <button className="btn btn-lime paywall-cta">
                  Anual · {yearlyPerMonth}/mês
                </button>
                <span className="paywall-note">{yearly.price} por ano, à vista</span>
              </form>
              <form action={subscribePro} data-posthog-event="pro_checkout_started" data-posthog-cycle="monthly">
                <input type="hidden" name="cycle" value="monthly" />
                <button className="btn btn-outline paywall-cta">
                  Mensal · {monthly.price}
                  {monthly.per}
                </button>
                <span className="paywall-note">Cancele quando quiser</span>
              </form>
            </div>
            <Link href="/dashboard/plano" className="paywall-more" onClick={() => ref.current?.close()}>
              Ver detalhes do plano
            </Link>
          </div>
        </div>
      )}
    </dialog>
  );
}
