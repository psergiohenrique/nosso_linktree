type Item = { key: string; label: string; count: number };

/** Barras horizontais de uma série só (sem legenda: o título do cartão diz o que é). */
export default function BarList({ items, total, empty }: { items: Item[]; total: number; empty: string }) {
  if (items.length === 0) return <p className="dash-empty">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count));
  return (
    <ul className="barlist">
      {items.map((item) => {
        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
        return (
          <li key={item.key} className="barlist-row" title={`${item.label}: ${item.count} (${pct}%)`}>
            <span className="barlist-label">{item.label}</span>
            <span className="barlist-track">
              <span className="barlist-bar" style={{ width: `${Math.max((item.count / max) * 100, 2)}%` }} />
            </span>
            <span className="barlist-value">
              {item.count} <span className="barlist-pct">{pct}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
