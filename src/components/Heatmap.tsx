const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DAY_NAMES = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

/** Grade 7 × 24 de visualizações por dia da semana e hora (linha 0 = segunda). */
export default function Heatmap({ data }: { data: number[][] }) {
  const max = Math.max(...data.flat());
  if (max === 0) return <p className="dash-empty">Sem visitas no período.</p>;

  let best = { d: 0, h: 0, v: -1 };
  data.forEach((row, d) =>
    row.forEach((v, h) => {
      if (v > best.v) best = { d, h, v };
    }),
  );

  return (
    <div className="heat">
      <p className="heat-peak">
        Pico: <strong>{DAY_NAMES[best.d]}, das {best.h}h às {best.h + 1}h</strong>. Bom horário para postar e
        responder rápido.
      </p>
      <div className="heat-scroll">
        <div className="heat-grid" role="table" aria-label="Visualizações por dia da semana e hora">
          {data.map((row, d) => (
            <div key={d} className="heat-row" role="row">
              <span className="heat-day" role="rowheader">
                {DAYS[d]}
              </span>
              {row.map((v, h) => (
                <span
                  key={h}
                  role="cell"
                  className="heat-cell"
                  title={`${DAYS[d]} ${h}h: ${v} ${v === 1 ? "visualização" : "visualizações"}`}
                  style={{ opacity: v === 0 ? 0.06 : 0.18 + 0.82 * (v / max) }}
                />
              ))}
            </div>
          ))}
          <div className="heat-row heat-hours" aria-hidden="true">
            <span className="heat-day" />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="heat-hour">
                {h % 6 === 0 ? `${h}h` : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
