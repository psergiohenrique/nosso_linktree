"use client";

import { useState } from "react";
import posthog from "posthog-js";

const PLATFORMS = [
  {
    id: "instagram",
    name: "Instagram",
    steps: [
      "Abra seu perfil e toque em “Editar perfil”.",
      "Toque em “Links” e depois em “Adicionar link externo”.",
      "Cole o link da sua página e salve.",
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    steps: [
      "Abra o WhatsApp Business e vá em Configurações, no perfil da empresa.",
      "Procure o campo “Site” ou “Links” e toque para adicionar.",
      "Cole o link da sua página e salve.",
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    steps: [
      "Abra seu perfil e toque no lápis para editar.",
      "Vá em “Informações de contato” e adicione um item em “Site”.",
      "Cole o link da sua página e salve.",
    ],
  },
] as const;

function track(event: string, props: Record<string, string>) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || !process.env.NEXT_PUBLIC_POSTHOG_HOST) return;
  posthog.capture(event, props);
}

export default function BioGuide({ url }: { url: string }) {
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]["id"]>("instagram");
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const current = PLATFORMS.find((p) => p.id === platform) ?? PLATFORMS[0];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Sem permissão de área de transferência: avisa e deixa o link à vista para copiar à mão.
      setFailed(true);
      return;
    }
    setFailed(false);
    setCopied(true);
    track("bio_link_copied", { source: "bio_guide" });
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <section className="card bio-guide" aria-labelledby="bio-guide-title">
      <div>
        <h2 id="bio-guide-title" className="card-title">Coloque na sua bio</h2>
        <p className="hint">É aqui que seus clientes vão encontrar sua página. Copie o link e cole no perfil.</p>
      </div>

      <div className="bio-guide-link">
        <code className="bio-guide-url">{url.replace(/^https?:\/\//, "")}</code>
        <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
          {copied ? "Link copiado" : "Copiar link"}
        </button>
      </div>
      <span className="sr-only" role="status">{copied ? "Link copiado" : ""}</span>
      {failed && <p className="hint" role="alert">Não deu para copiar sozinho. Selecione o link acima e copie.</p>}

      <div className="bio-guide-tabs" role="group" aria-label="Onde você vai colocar o link">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`bio-guide-tab${p.id === platform ? " is-active" : ""}`}
            aria-pressed={p.id === platform}
            onClick={() => {
              setPlatform(p.id);
              track("bio_guide_platform_viewed", { platform: p.id });
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      <ol className="bio-guide-steps">
        {current.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="hint">Os menus mudam com as versões dos aplicativos. Se não achar, procure por “Links” ou “Site” em editar perfil.</p>
    </section>
  );
}
