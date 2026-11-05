"use client";

import { useFormStatus } from "react-dom";

/** Botão de envio de formulário: desabilita e mostra o andamento enquanto a Server Action roda. */
export default function SubmitButton({
  children,
  pendingLabel,
  className = "btn btn-primary",
  ...rest
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "type" | "children">) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} className={className} disabled={pending || rest.disabled} aria-busy={pending || undefined}>
      {pending && <span className="spinner" aria-hidden="true" />}
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
}
