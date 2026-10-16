const STATS = [
  { num: "< 5 min", label: "Para publicar" },
  { num: "0%", label: "Comissão sobre vendas" },
  { num: "1 toque", label: "Até o WhatsApp" },
  { num: "LGPD", label: "Sem IP nem cookies" },
];

export default function StatsBar() {
  return (
    <div className="stats-bar">
      <div className="stats-row">
        {STATS.map((stat) => (
          <div key={stat.label} className="stat">
            <div className="stat-num">{stat.num}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
