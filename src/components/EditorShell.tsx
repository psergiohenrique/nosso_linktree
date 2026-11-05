import Logo from "./Logo";

/** Estrutura comum; autenticação, avisos e ações do cabeçalho chegam por composição. */
export default function EditorShell({ navigation, actions, children }: { navigation: React.ReactNode; actions: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="dash">
      <header className="dash-top">
        <Logo />
        {navigation}
        <div className="dash-top-actions">{actions}</div>
      </header>
      {children}
    </div>
  );
}

/** A prévia sabe pelo CSS se há uma barra inferior, sem configuração por página. */
export function EditorGrid({ children, preview }: { children: React.ReactNode; preview: React.ReactNode }) {
  return <div className="dash-grid"><main className="dash-main enter">{children}</main>{preview}</div>;
}
