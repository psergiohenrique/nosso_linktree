import Link from "next/link";
import { FREE_FEATURES, formatBRL, PRO_FEATURES, PRO_PRICES } from "@/lib/billing";
import { billingEnabled } from "@/server/billing";
import RevealWrapper from "./RevealWrapper";

/** Planos e preços. Só aparece com a cobrança ligada (sem ela, todo mundo tem tudo). */
export default function Planos() {
  if (!billingEnabled()) return null;
  const { monthly, yearly } = PRO_PRICES;

  return (
    <section className="planos" id="planos">
      <div className="wrap">
        <RevealWrapper className="planos-head">
          <p className="eyebrow">Planos</p>
          <h2 className="h2 planos-h2">
            Comece grátis. <span className="em">Cresça no Pro.</span>
          </h2>
          <p className="recursos-intro">Sem comissão sobre vendas em nenhum plano. Cancele quando quiser.</p>
        </RevealWrapper>

        <div className="planos-grid">
          <RevealWrapper className="plan-card">
            <p className="plan-name">Grátis</p>
            <p className="plan-price">
              R$ 0<span>/sempre</span>
            </p>
            <ul className="plan-feats">
              {FREE_FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link href="/login?modo=cadastro" className="btn btn-outline">
              Começar grátis
            </Link>
          </RevealWrapper>

          <RevealWrapper className="plan-card plan-card-pro plan-card-dark d1">
            <p className="plan-name">
              Pro <span className="plan-save">anual: {formatBRL(yearly.cents / 12)}/mês</span>
            </p>
            <p className="plan-price">
              {monthly.price}
              <span>{monthly.per}</span>
            </p>
            <p className="plan-alt">
              ou {yearly.price}
              {yearly.per} no anual
            </p>
            <ul className="plan-feats">
              <li>Tudo do Grátis</li>
              {PRO_FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link href="/login?modo=cadastro" className="btn btn-lime">
              Criar minha página
            </Link>
          </RevealWrapper>
        </div>
      </div>
    </section>
  );
}
