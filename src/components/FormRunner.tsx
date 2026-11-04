"use client";

import { useEffect, useRef, useState } from "react";
import { answerError, OTHER_LABEL, type FormField } from "@/lib/form-fields";
import { readProgress } from "@/lib/form-progress";

type Value = string | string[];
type Answers = Record<string, Value>;

type Props = {
  formId: string;
  title: string;
  intro: string;
  thankYou: string;
  fields: FormField[];
  /** Prévia do construtor: não envia nada. */
  preview?: boolean;
};

const textOf = (v: Value | undefined) => (Array.isArray(v) ? v.join(", ") : (v ?? "")).trim();
const listOf = (v: Value | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default function FormRunner({ formId, title, intro, thankYou, fields, preview = false }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  // Perguntas de escolha com "Outro" marcado e o texto digitado nele.
  const [other, setOther] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [ready, setReady] = useState(preview);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const idRef = useRef<string | null>(null);
  const versionRef = useRef(0);
  const conflictRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement | null>(null);
  const partialQueue = useRef<Promise<void>>(Promise.resolve());
  const moved = useRef(false);

  useEffect(() => {
    if (preview) return;
    try {
      const saved = readProgress(sessionStorage.getItem(`lbform:${formId}`), fields);
      idRef.current = saved?.id ?? crypto.randomUUID();
      versionRef.current = saved?.version ?? 0;
      conflictRef.current = saved?.conflict ?? false;
      // Hidratação a partir do armazenamento desta aba.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (conflictRef.current) setSaveWarning("Esta resposta foi atualizada em outra aba ou já foi enviada. Abra um novo formulário para continuar.");
      if (saved) {
        // A leitura do sessionStorage só pode ocorrer após a hidratação.
        setAnswers(saved.answers);
        setOther(saved.other);
        setStep(saved.step);
      }
    } catch {
      idRef.current = crypto.randomUUID();
      setStorageWarning(true);
    }
    setReady(true);
    // As perguntas são fixas durante a visita; mudanças são verificadas ao recarregar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, preview]);

  useEffect(() => {
    if (preview || !ready || status === "sent" || !idRef.current) return;
    try {
      sessionStorage.setItem(`lbform:${formId}`, JSON.stringify({
        id: idRef.current, version: versionRef.current, conflict: conflictRef.current, fields: JSON.stringify(fields), step, answers, other,
      }));
      // Reflete se a gravação no armazenamento do navegador funcionou.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
  }, [formId, preview, ready, status, fields, step, answers, other]);

  // Prévia: o construtor pode remover perguntas enquanto ela está aberta.
  const total = fields.length;
  const index = Math.min(step, Math.max(total - 1, 0));
  const field = fields[index];
  const isLast = index === total - 1;

  useEffect(() => {
    if (!moved.current) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [step]);

  if (!ready) return <p role="status">Recuperando suas respostas…</p>;
  if (!field) return null;

  /** Resposta final da pergunta, juntando o "Outro". */
  const valueOf = (f: FormField, base: Answers = answers, others = other): Value => {
    const o = others[f.id];
    if (f.type === "checkbox") {
      const picked = listOf(base[f.id]);
      return o != null && o.trim() ? [...picked, o.trim()] : picked;
    }
    if (f.type === "radio" && o != null) return o.trim();
    return base[f.id] ?? "";
  };

  const allAnswers = (base = answers, others = other) =>
    Object.fromEntries(fields.map((f) => [f.id, valueOf(f, base, others)]));

  const markConflict = () => {
    conflictRef.current = true;
    try {
      const key = `lbform:${formId}`;
      const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (saved?.id === idRef.current) sessionStorage.setItem(key, JSON.stringify({ ...saved, conflict: true }));
    } catch { setStorageWarning(true); }
    setSaveWarning("Esta resposta foi atualizada em outra aba ou já foi enviada. Abra um novo formulário para continuar.");
  };

  const reserveVersion = (savedStep: number, base: Answers, others: Record<string, string | null>) => {
    const version = ++versionRef.current;
    if (preview) return version;
    // Persiste antes de enviar: um reload não deve reutilizar a versão de uma requisição em trânsito.
    try {
      sessionStorage.setItem(`lbform:${formId}`, JSON.stringify({
        id: idRef.current, version, fields: JSON.stringify(fields), step: savedStep, answers: base, other: others,
      }));
    } catch {
      setStorageWarning(true);
    }
    return version;
  };

  const send = (status: "partial" | "complete", reached: number, body: Answers, version: number, id = idRef.current ?? "") => {
    if (preview) return Promise.resolve(new Response("{}", { status: 200 }));
    return fetch("/api/forms/publico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: status === "partial",
      body: JSON.stringify({ formId, responseId: id, status, step: reached, answers: body, version }),
    });
  };

  const submit = async (body: Answers, version: number) => {
    setStatus("sending");
    try {
      await partialQueue.current;
      if (conflictRef.current) { setStatus("idle"); return; }
      const res = await send("complete", total, body, version);
      if (res.status === 409) {
        markConflict();
        setError("Esta resposta foi atualizada em outra aba ou já foi enviada. Abra um novo formulário para continuar.");
        setStatus("idle");
        return;
      }
      if (res.status === 422) {
        // A validação não gravou nada; permite corrigir e reutilizar esta versão.
        if (versionRef.current === version) {
          versionRef.current = version - 1;
          try {
            const key = `lbform:${formId}`;
            const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
            if (saved?.id === idRef.current && saved.version === version) {
              sessionStorage.setItem(key, JSON.stringify({ ...saved, version: version - 1 }));
            }
          } catch { setStorageWarning(true); }
        }
        const data = await res.json().catch(() => ({}));
        const at = fields.findIndex((f) => f.id === data.fieldId);
        if (at >= 0) {
          moved.current = true;
          setStep(at);
        }
        setError(data.error ?? "Revise esta resposta.");
        setStatus("idle");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      idRef.current = null;
      if (!preview) {
        try {
          sessionStorage.removeItem(`lbform:${formId}`);
        } catch {}
      }
      setStatus("sent");
    } catch {
      setStatus("idle");
      setError("Não foi possível enviar agora. Tente de novo em instantes.");
    }
  };

  const next = (base = answers, others = other) => {
    if (conflictRef.current) { markConflict(); return; }
    const value = valueOf(field, base, others);
    const err = answerError(field, textOf(value), listOf(value));
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    moved.current = true;
    const body = allAnswers(base, others);
    if (isLast) {
      void submit(body, reserveVersion(index, base, others));
    } else {
      // Preserva a ordem das etapas mesmo quando uma requisição anterior demora mais.
      const id = idRef.current ?? "";
      const version = reserveVersion(index + 1, base, others);
      partialQueue.current = partialQueue.current.then(async () => {
        if (conflictRef.current) return;
        try {
          const res = await send("partial", index + 1, body, version, id);
          if (res.status === 409) {
            markConflict();
            return;
          }
          if (!res.ok) throw new Error(String(res.status));
          setSaveWarning(null);
        } catch {
          setSaveWarning("Não foi possível salvar esta etapa no servidor. Continue e tente enviar ao final.");
        }
      });
      setStep(index + 1); // valor absoluto: clique duplo não pula etapa
    }
  };

  const setValue = (v: Value) => {
    setError(null);
    setAnswers((prev) => ({ ...prev, [field.id]: v }));
  };

  const chooseRadio = (option: string) => {
    const base = { ...answers, [field.id]: option };
    const others = { ...other, [field.id]: null };
    setAnswers(base);
    setOther(others);
    setError(null);
    window.setTimeout(() => next(base, others), 180);
  };

  const toggleCheckbox = (option: string) => {
    const picked = listOf(answers[field.id]);
    setValue(picked.includes(option) ? picked.filter((o) => o !== option) : [...picked, option]);
  };

  const toggleOther = () => {
    setError(null);
    if (field.type === "radio") setAnswers((prev) => ({ ...prev, [field.id]: "" }));
    setOther((prev) => ({ ...prev, [field.id]: prev[field.id] == null ? "" : field.type === "checkbox" ? null : "" }));
  };

  if (status === "sent") {
    return (
      <div className="bf-done" role="status">
        <p className="bf-done-title">Obrigado!</p>
        <p className="bf-done-text">{thankYou || "Recebemos suas respostas. Logo entraremos em contato."}</p>
      </div>
    );
  }

  const otherOn = other[field.id] != null;
  const picked = listOf(answers[field.id]);
  const keyLetter = (i: number) => String.fromCharCode(65 + i);
  const inputProps = {
    ref: (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      inputRef.current = el;
    },
    "aria-label": field.label,
    className: "bf-input",
  };

  return (
    <form
      className="bf"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        next();
      }}
    >
      {index === 0 && (title || intro) && (
        <header className="bf-head">
          {title && <h1 className="bf-title">{title}</h1>}
          {intro && <p className="bf-intro">{intro}</p>}
        </header>
      )}

      <div className="bf-progress" aria-hidden="true">
        <span style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
      <p className="bf-count">
        {index + 1} / {total}
      </p>

      <fieldset className="bf-step" key={field.id}>
        <legend className="bf-label">
          {field.label}
          {field.required && <span className="bf-req"> *</span>}
        </legend>
        {field.description && <p className="bf-desc">{field.description}</p>}

        {field.type === "radio" || field.type === "checkbox" ? (
          <div className="bf-options">
            {field.options.map((opt, i) => {
              const on = field.type === "radio" ? answers[field.id] === opt && !otherOn : picked.includes(opt);
              return (
                <button
                  type="button"
                  key={opt}
                  ref={i === 0 ? (el) => { inputRef.current = el; } : undefined}
                  aria-pressed={on}
                  className={`bio-link bf-option ${on ? "is-on" : ""}`}
                  onClick={() => (field.type === "radio" ? chooseRadio(opt) : toggleCheckbox(opt))}
                >
                  <span className="bf-key">{keyLetter(i)}</span>
                  <span className="bf-option-text">{opt}</span>
                </button>
              );
            })}
            {field.allowOther && (
              <button
                type="button"
                aria-pressed={otherOn}
                className={`bio-link bf-option ${otherOn ? "is-on" : ""}`}
                onClick={toggleOther}
              >
                <span className="bf-key">{keyLetter(field.options.length)}</span>
                <span className="bf-option-text">{OTHER_LABEL}</span>
              </button>
            )}
            {otherOn && (
              <input
                {...inputProps}
                autoFocus
                placeholder="Escreva sua resposta"
                maxLength={200}
                value={other[field.id] ?? ""}
                onChange={(e) => {
                  setError(null);
                  setOther((prev) => ({ ...prev, [field.id]: e.target.value }));
                }}
              />
            )}
          </div>
        ) : field.type === "textarea" ? (
          <textarea
            {...inputProps}
            rows={4}
            placeholder="Digite sua resposta…"
            maxLength={4000}
            value={(answers[field.id] as string) ?? ""}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                next();
              }
            }}
          />
        ) : (
          <input
            {...inputProps}
            type={field.type}
            inputMode={field.type === "tel" ? "tel" : field.type === "email" ? "email" : undefined}
            autoComplete={field.type === "tel" ? "tel" : field.type === "email" ? "email" : index === 0 ? "name" : "off"}
            placeholder={field.type === "tel" ? "(00) 00000-0000" : field.type === "email" ? "voce@email.com" : "Digite sua resposta…"}
            maxLength={field.type === "text" ? 300 : 200}
            value={(answers[field.id] as string) ?? ""}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
      </fieldset>

      {error && (
        <p className="bf-error" role="alert">
          {error}
        </p>
      )}

      <div className="bf-actions">
        {index > 0 && (
          <button
            type="button"
            className="bf-back"
            disabled={status === "sending"}
            onClick={() => {
              setError(null);
              setStep(index - 1);
            }}
          >
            ← Voltar
          </button>
        )}
        <button type="submit" className="bio-link bf-next" disabled={status === "sending"}>
          {status === "sending" ? "Enviando…" : isLast ? "Enviar" : "OK"}
        </button>
      </div>

      {!preview && (
        <>
          {saveWarning && <p className="bf-error" role="alert">{saveWarning}</p>}
          {storageWarning && <p className="bf-error" role="alert">Não foi possível guardar o progresso neste navegador. Ao recarregar, suas respostas podem ser perdidas.</p>}
          <p className="bf-privacy">Ao avançar, suas respostas podem ser enviadas e salvas mesmo que você não conclua o formulário. Seu progresso também é guardado no armazenamento desta aba do navegador para recuperação; ele é removido após o envio ou ao fechar a aba.</p>
        </>
      )}
    </form>
  );
}
