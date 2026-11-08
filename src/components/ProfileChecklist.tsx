import Link from "next/link";
import type { ChecklistItem } from "@/lib/profile-checklist";

/** Lembrete leve no topo da aba Links. Some sozinho quando tudo está feito e nunca bloqueia nada. */
export default function ProfileChecklist({ items }: { items: ChecklistItem[] }) {
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;

  return (
    <section className="card profile-checklist" aria-labelledby="checklist-title">
      <div className="checklist-head">
        <h2 id="checklist-title" className="card-title">Deixe sua página pronta</h2>
        <span className="checklist-count">{done} de {items.length}</span>
      </div>
      <div
        className="checklist-meter"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={done}
        aria-label="Passos concluídos"
      >
        <span style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <ul className="checklist-list">
        {items.map((item) => (
          <li key={item.id} className={`checklist-item${item.done ? " is-done" : ""}`}>
            <span className="checklist-mark" aria-hidden="true">{item.done ? "✓" : ""}</span>
            <span className="checklist-text">
              <strong>{item.label}</strong>
              {!item.done && <span className="hint">{item.hint}</span>}
            </span>
            {item.done ? (
              <span className="sr-only">Feito</span>
            ) : item.action.kind === "href" ? (
              <Link href={item.action.href} className="btn btn-outline btn-sm">{item.action.label}</Link>
            ) : (
              <button type="button" className="btn btn-outline btn-sm" data-new-link>{item.action.label}</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
