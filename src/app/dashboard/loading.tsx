/**
 * Esqueleto mostrado na hora ao trocar de aba do painel, enquanto o servidor monta a página.
 * (O Next também o pré-carrega nos links das abas, então o clique responde sem esperar a rede.)
 */
export default function DashboardLoading() {
  return (
    <div className="dash-grid" aria-busy="true" aria-label="Carregando">
      <div className="dash-main">
        <div className="skel skel-title" />
        <div className="skel skel-tall" />
        <div className="skel skel-card" />
        <div className="skel skel-card" />
        <div className="skel skel-card" />
      </div>
      <div className="skel skel-tall skel-phone" style={{ height: 520 }} />
    </div>
  );
}
