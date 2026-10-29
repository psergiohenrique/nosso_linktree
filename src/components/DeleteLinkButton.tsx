"use client";

import { useId, useRef } from "react";
import { useFormStatus } from "react-dom";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-outline btn-danger" disabled={pending}>
      {pending ? "Excluindo…" : "Sim, excluir"}
    </button>
  );
}

export default function DeleteLinkButton({
  id,
  title,
  action,
  onConfirm,
}: {
  id: string;
  title: string;
  action?: (formData: FormData) => Promise<void>;
  onConfirm?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div className="push">
      <button type="button" className="btn btn-outline btn-sm btn-danger" onClick={() => dialog.current?.showModal()}>
        Excluir
      </button>
      <dialog ref={dialog} className="paywall confirm-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <div className="paywall-content">
          <h2 id={titleId} className="paywall-title">Excluir link?</h2>
          <p id={descriptionId} className="paywall-text">Tem certeza de que deseja excluir “{title}”? Esta ação não pode ser desfeita.</p>
          <form
            action={action}
            data-posthog-event={action ? "link_deleted" : undefined}
            className="confirm-actions"
            onSubmit={onConfirm ? (event) => { event.preventDefault(); dialog.current?.close(); onConfirm(); } : undefined}
          >
            <input type="hidden" name="id" value={id} />
            <button type="button" className="btn btn-outline" onClick={() => dialog.current?.close()} autoFocus>Cancelar</button>
            <ConfirmButton />
          </form>
        </div>
      </dialog>
    </div>
  );
}
