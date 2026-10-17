import RevealWrapper from "./RevealWrapper";

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const FEATURES = [
  {
    title: "Botão de WhatsApp",
    desc: "Um toque abre a conversa com a mensagem já escrita. O cliente não precisa salvar seu número.",
    icon: <path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.38 8.38 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.38 8.38 0 0 1 9 8.5z" />,
    dark: true,
  },
  {
    title: "Métricas que importam",
    desc: "Visualizações, cliques e taxa de clique por link, e de onde vem cada visita. Veja o que converte.",
    icon: <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />,
  },
  {
    title: "Pronta em minutos",
    desc: "Escolha seu endereço, adicione os links e publique. Sem código, sem designer.",
    icon: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  },
  {
    title: "Rápida no celular",
    desc: "Página leve, renderizada no servidor e em cache. Abre na hora para quem vem do Instagram.",
    icon: (
      <>
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <path d="M12 18h.01" />
      </>
    ),
  },
  {
    title: "Sua cara, sua cor",
    desc: "Temas claro, escuro e pôr do sol, com a cor de destaque da sua marca.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 0 0 18" fill="currentColor" />
      </>
    ),
  },
  {
    title: "Privacidade de verdade",
    desc: "Não guardamos IP nem cookies de rastreio. Só origem da visita e tipo de dispositivo.",
    icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  },
];

export default function Recursos() {
  return (
    <section className="recursos" id="recursos">
      <div className="wrap">
        <div className="recursos-head">
          <RevealWrapper>
            <p className="eyebrow">Recursos</p>
            <h2 className="h2 recursos-h2">
              Mais que links: <span className="em">conversas</span>
            </h2>
          </RevealWrapper>
          <RevealWrapper as="p" className="recursos-intro d1">
            O dono do negócio quer gerar contato, não só &ldquo;ter links&rdquo;. O Linkbio foi
            pensado para isso desde o primeiro botão.
          </RevealWrapper>
        </div>

        <div className="feat-grid">
          {FEATURES.map((feat, i) => (
            <RevealWrapper
              key={feat.title}
              className={`feat-card ${feat.dark ? "feat-card-dark" : ""} d${(i % 3) + 1}`}
            >
              <div className="feat-icon">
                <svg {...ICON_PROPS} aria-hidden="true">
                  {feat.icon}
                </svg>
              </div>
              <h3 className="feat-title">{feat.title}</h3>
              <p className="feat-desc">{feat.desc}</p>
            </RevealWrapper>
          ))}
        </div>
      </div>
    </section>
  );
}
