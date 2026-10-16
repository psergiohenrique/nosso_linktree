import Link from "next/link";

const SAMPLE_LINKS = ["Ver tabela de preços", "Como chegar", "Instagram"];

export default function Hero() {
  return (
    <section className="hero" id="hero">
      <div className="hero-blob" />

      <div className="hero-grid">
        <div className="hero-copy">
          <p className="hero-pill">
            <span className="hero-pill-dot" />
            Sem comissão sobre vendas
          </p>
          <h1 className="hero-h1">
            Seu link na bio, feito para <span className="em">vender</span> no WhatsApp
          </h1>
          <p className="hero-text">
            Crie sua página em minutos, com botão de WhatsApp em destaque e métricas
            de cliques para saber o que gera conversa de verdade.
          </p>
          <div className="hero-ctas">
            <Link href="/login?modo=cadastro" className="btn btn-primary">
              Criar minha página
            </Link>
            <Link href="/demo" className="btn btn-outline">
              Ver exemplo →
            </Link>
          </div>
          <p className="hero-note">Grátis para começar · Sem cartão de crédito</p>
        </div>

        <div className="hero-phone-col" aria-hidden="true">
          <div className="phone">
            <div className="phone-screen">
              <div className="phone-avatar">B</div>
              <p className="phone-name">Barbearia do Zé</p>
              <p className="phone-bio">Corte, barba e cerveja gelada. Seg a sáb, 9h às 20h.</p>
              <div className="phone-link phone-link-whats">💬 Agendar pelo WhatsApp</div>
              {SAMPLE_LINKS.map((title) => (
                <div key={title} className="phone-link">
                  {title}
                </div>
              ))}
              <p className="phone-foot">Feito com Linkbio</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
