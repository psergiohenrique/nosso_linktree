import { sendMagicLink } from './actions';

export default function Login({ searchParams }: { searchParams: { sent?: string; error?: string } }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-bold">Entrar ou criar conta</h1>
      {searchParams.sent ? (
        <p className="rounded-lg bg-green-50 p-4 text-green-800">
          Enviamos um link para o seu e-mail. Abra-o para entrar.
        </p>
      ) : (
        <form action={sendMagicLink} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="email">
            Seu e-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
          {searchParams.error && <p className="text-sm text-red-600">{searchParams.error}</p>}
          <button className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white">Receber link de acesso</button>
        </form>
      )}
    </main>
  );
}
