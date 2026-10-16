import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Seu link na bio, feito para vender no WhatsApp</h1>
      <p className="text-lg text-neutral-600">
        Crie sua página em minutos, com botão de WhatsApp e métricas de cliques. Sem comissão sobre vendas.
      </p>
      <div className="flex gap-3">
        <Link href="/login" className="rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white">
          Criar minha página
        </Link>
        <Link href="/demo" className="rounded-lg border border-neutral-300 px-5 py-3 font-medium">
          Ver exemplo
        </Link>
      </div>
    </main>
  );
}
