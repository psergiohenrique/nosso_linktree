import Link from "next/link";
import { FREE_LINK_LIMIT, FREE_STATS_DAYS, formatBRL, PRO_PRICES } from "@/lib/billing";
import { billingEnabled } from "@/server/billing";
import RevealWrapper from "./RevealWrapper";

const { monthly, yearly } = PRO_PRICES;
const YEARLY_SAVING = monthly.cents * 12 - yearly.cents;
const YEARLY_DISCOUNT = Math.round((YEARLY_SAVING / (monthly.cents * 12)) * 100);

const PRO_HIGHLIGHTS = [
  "Links ilimitados",
  "Formatos Destaque e Bloco",
  "Resultados de 30 e 90 dias",
  "Métricas avançadas: horários, cidades, campanhas e CSV",
  "Sem o selo “Feito com Linkbio”",
];

const PLANS = [
  {
    key: "free",
    name: "Grátis",
    price: "R$ 0",
    per: "/sempre",
    note: "Sem cartão de crédito.",
    intro: "Para colocar a página no ar hoje.",
    feats: [
      `Até ${FREE_LINK_LIMIT} links`,
      "Botão de WhatsApp com mensagem pronta",
      "Todos os temas, cores e fontes",
      `Resultados dos últimos ${FREE_STATS_DAYS} dias`,
      "Resumo semanal por e-mail",
      "Selo “Feito com Linkbio”",
    ],
    cta: "Começar grátis",
  },
  {
    key: "monthly",
    name: "Pro mensal",
    price: monthly.price,
    per: monthly.per,
    note: "Cancele quando quiser.",
    intro: "Tudo do Grátis, mais:",
    feats: PRO_HIGHLIGHTS,
    cta: "Assinar o mensal",
  },
  {
    key: "yearly",
    name: "Pro anual",
    price: formatBRL(yearly.cents / 12).replace(",00", ""),
    per: "/mês",
    note: `${yearly.price} por ano, à vista no cartão.`,
    intro: "Tudo do Pro mensal, pagando menos:",
    feats: [...PRO_HIGHLIGHTS, `Economia de ${formatBRL(YEARLY_SAVING)} por ano`],
    cta: "Assinar o anual",
    badge: "Mais vantajoso",
  },
] as const;

const COMPARE: { label: string; free: string | boolean; pro: string | boolean }[] = [
  { label: "Página no ar com endereço próprio", free: true, pro: true },
  { label: "Links", free: `Até ${FREE_LINK_LIMIT}`, pro: "Ilimitados" },
  { label: "Botão de WhatsApp com mensagem pronta", free: true, pro: true },
  { label: "Temas, cores, estilos de botão e fontes", free: true, pro: true },
  { label: "Imagem em cada link", free: true, pro: true },
  { label: "Formatos Destaque (imagem grande) e Bloco (grade)", free: false, pro: true },
  { label: "Visualizações, cliques e taxa de clique", free: `${FREE_STATS_DAYS} dias`, pro: "7, 30 e 90 dias" },
  { label: "Origem das visitas e dispositivo", free: `${FREE_STATS_DAYS} dias`, pro: "7, 30 e 90 dias" },
  { label: "Conversas no WhatsApp e comparação com o período anterior", free: true, pro: true },
  { label: "Resumo semanal por e-mail", free: true, pro: true },
  { label: "De onde vem quem clica em cada link", free: false, pro: true },
  { label: "Horários de pico e cidades das visitas", free: false, pro: true },
  { label: "Campanhas (UTM) e exportação em planilha (CSV)", free: false, pro: true },
  { label: "Selo “Feito com Linkbio” na página", free: "Aparece", pro: "Não aparece" },
  { label: "Comissão sobre suas vendas", free: "0%", pro: "0%" },
];

const FAQ = [
  {
    q: "Posso usar o Linkbio de graça para sempre?",
    a: `Sim. O plano Grátis não tem prazo: sua página fica no ar com até ${FREE_LINK_LIMIT} links, botão de WhatsApp e todos os temas. Não pedimos cartão para começar.`,
  },
  {
    q: "O que muda quando eu assino o Pro?",
    a: `Você passa a ter links ilimitados, os formatos Destaque e Bloco, resultados de 30 e 90 dias, métricas avançadas (origem de quem clica em cada link, horários de pico, cidades, campanhas e exportação em CSV) e sua página deixa de mostrar o selo “Feito com Linkbio”. Tudo é liberado assim que o pagamento é confirmado.`,
  },
  {
    q: "Posso cancelar quando quiser? Tem multa ou fidelidade?",
    a: "Pode cancelar pelo próprio painel, a qualquer momento, sem multa. O Pro continua valendo até o fim do período que você já pagou.",
  },
  {
    q: "Se eu cancelar, perco meus links?",
    a: `Não. Nada é apagado. Sua página volta ao plano Grátis e mostra os ${FREE_LINK_LIMIT} primeiros links ativos; os demais ficam guardados e voltam a aparecer se você assinar de novo.`,
  },
  {
    q: "Quais formas de pagamento vocês aceitam?",
    a: "Cartão de crédito, com renovação automática. O pagamento é processado pelo Asaas, e não guardamos os dados do seu cartão.",
  },
  {
    q: "Vocês cobram comissão sobre minhas vendas?",
    a: "Não, em nenhum plano. O cliente fala direto com você no WhatsApp; o que você vende é 100% seu.",
  },
  {
    q: "Posso trocar do mensal para o anual depois?",
    a: "Pode, pela aba Plano do painel. O novo plano só começa a ser cobrado quando o período atual terminar, sem cobrança dupla.",
  },
];

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <span className="compare-yes" aria-label="Incluído">✓</span>;
  if (value === false) return <span className="compare-no" aria-label="Não incluído">—</span>;
  return <>{value}</>;
}

export default function Planos() {
  // Com a cobrança desligada, todo mundo usa o Pro: a tabela fica, mas o aviso não deixa dúvida.
  const launch = !billingEnabled();

  return (
    <section className="planos" id="planos">
      <div className="wrap">
        <RevealWrapper className="planos-head">
          <p className="eyebrow">Planos</p>
          <h2 className="h2 planos-h2">
            Comece grátis. <span className="em">Cresça no Pro.</span>
          </h2>
          <p className="recursos-intro">
            Preço em reais, sem comissão sobre vendas e sem fidelidade. No anual você economiza {YEARLY_DISCOUNT}%.
          </p>
        </RevealWrapper>

        {launch && (
          <p className="planos-launch">
            <strong>Lançamento:</strong> por enquanto, todos os recursos do Pro estão liberados sem custo para quem
            criar a página.
          </p>
        )}

        <div className="planos-grid">
          {PLANS.map((plan, i) => (
            <RevealWrapper
              key={plan.key}
              className={`plan-card ${plan.key === "yearly" ? "plan-card-dark" : ""} ${i ? `d${i}` : ""}`}
            >
              <p className="plan-name">
                {plan.name}
                {"badge" in plan && <span className="plan-save">{plan.badge}</span>}
              </p>
              <p className="plan-price">
                {plan.price}
                <span>{plan.per}</span>
              </p>
              <p className="plan-alt">{plan.note}</p>
              <p className="plan-intro">{plan.intro}</p>
              <ul className="plan-feats">
                {plan.feats.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link
                href="/login?modo=cadastro"
                className={`btn ${plan.key === "yearly" ? "btn-lime" : plan.key === "monthly" ? "btn-primary" : "btn-outline"}`}
              >
                {launch ? "Criar minha página" : plan.cta}
              </Link>
            </RevealWrapper>
          ))}
        </div>

        <RevealWrapper className="compare">
          <h3 className="compare-title">Compare os planos</h3>
          <div className="compare-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">Recurso</th>
                  <th scope="col">Grátis</th>
                  <th scope="col">Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>
                      <Cell value={row.free} />
                    </td>
                    <td>
                      <Cell value={row.pro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealWrapper>

        <div className="faq">
          <h3 className="compare-title">Perguntas frequentes</h3>
          {FAQ.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
