import { COMPANY_NAME, COMPANY_URL, SITE_NAME } from "@/lib/site";
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
          <span>© {new Date().getFullYear()} {COMPANY_NAME}. Todos os direitos reservados.</span>
          <span>
            {SITE_NAME} é um produto <a href={COMPANY_URL}>{COMPANY_NAME}</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
