"use client";

import { useFormStatus } from "react-dom";

export default function AddLinkButton() {
  const { pending } = useFormStatus();

  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Adicionando…" : "Adicionar"}
    </button>
  );
}
