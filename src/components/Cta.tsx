import Link from "next/link";
import RevealWrapper from "./RevealWrapper";

export default function Cta() {
  return (
    <section className="cta" id="comecar">
      <div className="wrap">
        <RevealWrapper className="cta-box">
          <div className="cta-copy">
            <h2 className="h2 cta-h2">
              Sua próxima venda começa <span className="em">na bio</span>
            </h2>
            <p className="cta-text">
              Crie sua página agora. É grátis para começar e você publica em menos de 5 minutos.
            </p>
          </div>
          <div className="cta-actions">
            <Link href="/login" className="btn btn-lime">
              Criar minha página
            </Link>
            <Link href="/demo" className="btn btn-outline">
              Ver exemplo
            </Link>
          </div>
        </RevealWrapper>
      </div>
    </section>
  );
}
