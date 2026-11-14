"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { requestMagicLink, type MagicLinkState } from "@/app/login/actions";
import { LOGIN_LINK_MINUTES } from "@/lib/login-link";

const COOLDOWN_SECONDS = 15;

function SendButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending || disabled}>
      {pending ? "Enviando…" : label}
    </button>
  );
}

/** Pede o link e, depois, oferece reenviar o mesmo e-mail sem colocá-lo na URL. */
export default function MagicLinkForm() {
  const [state, action] = useActionState<MagicLinkState, FormData>(requestMagicLink, {});
  const [now, setNow] = useState(() => Date.now());
  const cooling = typeof state.sentAt === "number" && state.sentAt + COOLDOWN_SECONDS * 1000 > now;

  useEffect(() => {
    if (!cooling) return;
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [cooling, now]);

  if (state.sent && state.email) {
    return (
      <>
        <p className="notice notice-ok" role="status">
          Se houver conta com esse e-mail, enviamos o link. Ele vale por {LOGIN_LINK_MINUTES} minutos. Confira também o
          spam.
        </p>
        <form action={action} className="auth-form">
          <input type="hidden" name="email" value={state.email} />
          <SendButton label="Reenviar" disabled={cooling} />
        </form>
        {cooling && <p className="auth-text">Aguarde alguns segundos para reenviar.</p>}
        {state.error && (
          <p className="notice notice-error" role="alert">
            {state.error}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <p className="auth-text">Informe o e-mail da sua conta e enviaremos um link para entrar, sem senha.</p>
      <form action={action} className="auth-form">
        <div>
          <label className="field-label" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            defaultValue={state.email}
            className="field"
          />
        </div>
        {state.error && (
          <p className="notice notice-error" role="alert">
            {state.error}
          </p>
        )}
        <SendButton label="Enviar link" />
      </form>
    </>
  );
}
