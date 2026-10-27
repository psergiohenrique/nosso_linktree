import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import { SITE_HOST } from "@/lib/site";

// O Next já põe noindex nas respostas 404; sem o robots daqui, sairia também o "index, follow" do layout.
export const metadata: Metadata = { title: "Página não encontrada", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <main className="auth">
      <Logo />
      <div className="auth-card">
        <h1 className="h2 auth-h1">Página não encontrada</h1>
        <p className="auth-text">
          Não existe nenhuma página neste endereço. Pode ter sido digitado errado ou o endereço mudou.
        </p>
        <Link href="/login?modo=cadastro" className="btn btn-primary">
          Criar minha página em {SITE_HOST}
        </Link>
        <p className="auth-switch">
          <Link href="/">Conhecer o Linkbio</Link>
        </p>
      </div>
    </main>
  );
}
