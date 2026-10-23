"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signUp, type SignUpState } from "@/app/login/actions";
import PasswordInput from "./PasswordInput";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Criando…" : "Criar conta"}
    </button>
  );
}

/** Cadastro: nome, sobrenome, Instagram (opcional), e-mail, senha e confirmação. */
export default function SignupForm() {
  const [state, action] = useActionState<SignUpState, FormData>(signUp, {});
  const v = state.values;

  return (
    // key: depois de um erro o formulário volta com o que foi digitado (menos as senhas).
    <form action={action} className="auth-form" key={JSON.stringify(state)}>
      <div className="field-row">
        <div>
          <label className="field-label" htmlFor="first_name">
            Nome
          </label>
          <input
            id="first_name"
            name="first_name"
            required
            maxLength={60}
            autoComplete="given-name"
            defaultValue={v?.first_name}
            className="field"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="last_name">
            Sobrenome
          </label>
          <input
            id="last_name"
            name="last_name"
            required
            maxLength={60}
            autoComplete="family-name"
            defaultValue={v?.last_name}
            className="field"
          />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="instagram">
          Instagram <span className="field-optional">(opcional)</span>
        </label>
        <input
          id="instagram"
          name="instagram"
          placeholder="@seunegocio"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={v?.instagram}
          className="field"
        />
      </div>
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
          defaultValue={v?.email}
          className="field"
        />
      </div>
      <div>
        <label className="field-label" htmlFor="password">
          Senha
        </label>
        <PasswordInput id="password" name="password" minLength={8} autoComplete="new-password" />
      </div>
      <div>
        <label className="field-label" htmlFor="confirm">
          Confirme a senha
        </label>
        <PasswordInput id="confirm" name="confirm" minLength={8} autoComplete="new-password" />
      </div>
      {state.error && <p className="notice notice-error">{state.error}</p>}
      <Submit />
    </form>
  );
}
