import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { socialMetadata } from "@/lib/seo";
import { billingEnabled } from "@/server/billing";

const DESCRIPTION = "Crie formulários para sua página de links, acompanhe respostas completas e parciais e inicie conversas pelo WhatsApp com o Linkbio Pro.";

export const metadata: Metadata = {
  title: "Formulários para sua página de links",
  description: DESCRIPTION,
  alternates: { canonical: "/formularios" },
  ...socialMetadata({ title: "Formulários para sua página de links · Linkbio", description: DESCRIPTION, path: "/formularios" }),
};

const FEATURES = [
  { title: "Perguntas do seu jeito", desc: "Crie até 30 perguntas de texto, telefone, e-mail ou escolha única e múltipla. Defina quais são obrigatórias e ofereça a opção Outro nas escolhas." },
  { title: "Publique e compartilhe", desc: "Personalize título, introdução e agradecimento, confira a prévia e publique em um endereço ligado à sua página. Copie o link ou adicione-o à sua bio." },
  { title: "Acompanhe as respostas", desc: "Veja respostas completas e incompletas no painel, filtre, consulte detalhes e exclua quando precisar. Se houver telefone, inicie o acompanhamento pelo WhatsApp." },
  { title: "Não perca o contexto", desc: "Respostas podem ser salvas antes da conclusão. Ao recarregar a mesma aba, o visitante pode recuperar o progresso quando as perguntas não mudaram." },
  { title: "Aviso por e-mail", desc: "Ative a notificação para saber quando receber uma resposta completa." },
  { title: "Integração com site externo", desc: "Um site com interface própria pode enviar respostas por integração entre servidores. A criação do formulário externo e sua chave são feitas pelo administrador." },
];

export default function Formularios() {
  const launch = !billingEnabled();
  return (
    <>
      <Nav />
      <main>
        <section className="hero">
          <div className="hero-blob" />
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="hero-pill"><span className="hero-pill-dot" /> Incluído no Linkbio Pro</p>
              <h1 className="hero-h1">Mais respostas, <span className="em">mais conversas</span></h1>
              <p className="hero-text">Crie formulários para conhecer seus clientes, receba respostas na sua página e continue a conversa pelo WhatsApp.</p>
              <div className="hero-ctas">
                <Link href="/login?modo=cadastro" className="btn btn-primary">{launch ? "Criar minha página" : "Começar com o Linkbio"}</Link>
                <Link href="/#planos" className="btn btn-outline">Conhecer os planos →</Link>
              </div>
              <p className="hero-note">{launch ? "Lançamento: recursos Pro liberados sem custo por enquanto." : "Formulários fazem parte do plano Pro."}</p>
            </div>
          </div>
        </section>
        <section className="recursos">
          <div className="wrap">
            <div className="recursos-head">
              <div><p className="eyebrow">Formulários</p><h2 className="h2 recursos-h2">Do primeiro interesse à <span className="em">conversa</span></h2></div>
              <p className="recursos-intro">Receba pedidos, conheça necessidades e organize os contatos em um só lugar.</p>
            </div>
            <div className="feat-grid">
              {FEATURES.map((feature) => <article className="feat-card" key={feature.title}><h3 className="feat-title">{feature.title}</h3><p className="feat-desc">{feature.desc}</p></article>)}
            </div>
          </div>
        </section>
        <section className="como">
          <div className="wrap">
            <div className="como-head"><p className="eyebrow">Como funciona</p><h2 className="h2 como-h2">Crie, publique e acompanhe</h2></div>
            <ol className="steps">
              <li className="step"><p className="step-num">01</p><h3 className="step-title">Monte seu formulário</h3><p className="step-desc">No painel, crie um rascunho, escolha as perguntas e confira a prévia.</p></li>
              <li className="step"><p className="step-num">02</p><h3 className="step-title">Compartilhe o endereço</h3><p className="step-desc">Publique e compartilhe o link ou adicione-o à sua página.</p></li>
              <li className="step"><p className="step-num">03</p><h3 className="step-title">Cuide de cada contato</h3><p className="step-desc">Consulte as respostas no painel e, quando houver telefone, abra uma conversa no WhatsApp.</p></li>
            </ol>
          </div>
        </section>
        <section className="cta">
          <div className="wrap"><div className="cta-box"><div className="cta-copy"><h2 className="h2 cta-h2">Transforme interesse em <span className="em">conversa</span></h2><p className="cta-text">Crie sua página e descubra como os formulários podem ajudar seu negócio.</p></div><div className="cta-actions"><Link href="/login?modo=cadastro" className="btn btn-lime">{launch ? "Criar minha página" : "Começar com o Linkbio"}</Link><Link href="/#planos" className="btn btn-outline">Conhecer os planos</Link></div></div></div>
        </section>
      </main>
      <Footer />
    </>
  );
}
