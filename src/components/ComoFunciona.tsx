import RevealWrapper from "./RevealWrapper";

const STEPS = [
  {
    title: "Entre com seu e-mail",
    desc: "Sem senha: enviamos um link de acesso direto para a sua caixa de entrada.",
  },
  {
    title: "Escolha seu endereço",
    desc: "Algo como linkbio/barbearia-do-ze. Curto, fácil de lembrar e de colocar na bio.",
  },
  {
    title: "Adicione links e publique",
    desc: "WhatsApp, cardápio, localização, Instagram. Reordene quando quiser e acompanhe os cliques.",
  },
];

export default function ComoFunciona() {
  return (
    <section className="como" id="como-funciona">
      <div className="wrap">
        <RevealWrapper className="como-head">
          <p className="eyebrow">Como funciona</p>
          <h2 className="h2 como-h2">Três passos e pronto</h2>
        </RevealWrapper>

        <ol className="steps">
          {STEPS.map((step, i) => (
            <RevealWrapper as="li" key={step.title} className={`step d${i + 1}`}>
              <div className="step-num">{String(i + 1).padStart(2, "0")}</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.desc}</p>
            </RevealWrapper>
          ))}
        </ol>
      </div>
    </section>
  );
}
