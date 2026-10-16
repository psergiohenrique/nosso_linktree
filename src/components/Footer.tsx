import Logo from "./Logo";

const LINKS = [
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "/demo", label: "Exemplo" },
  { href: "/login", label: "Entrar" },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-top">
          <Logo href="#hero" />
          <div className="footer-links">
            {LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Linkbio. Todos os direitos reservados.</span>
          <span>Link na bio para pequenos negócios</span>
        </div>
      </div>
    </footer>
  );
}
