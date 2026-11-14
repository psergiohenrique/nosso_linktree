import type { EditorLink, LinkEditorAccess, LinkEditorActions } from "@/lib/editor";
import LinkCard from "./LinkCard";
import NewLinkSheet from "./NewLinkSheet";
import SortableLinks from "./SortableLinks";

type Props = {
  links: EditorLink[];
  actions: LinkEditorActions;
  access: LinkEditorAccess;
  beforeLinks?: React.ReactNode;
  trackEvents?: boolean;
  onDraftChange?: (data: FormData) => void;
  onImageFile?: (id: string, file: File | null) => void;
};

/** Fonte única da composição de Links; operações de servidor/local chegam pelo adaptador. */
export default function LinksEditor({ links, actions, access, beforeLinks, trackEvents = false, onDraftChange, onImageFile }: Props) {
  return (
    <>
      <div className="dash-head dash-head-row">
        <div>
          <p className="eyebrow">Links</p>
          <h1 className="h2 dash-h1">Seus links</h1>
        </div>
        <button type="button" className="btn btn-primary" data-new-link>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Novo link
        </button>
      </div>
      {beforeLinks}
      <NewLinkSheet action={actions.create} {...access} trackEvents={trackEvents} />
      {links.length === 0 && (
        <div className="link-empty">
          <strong>Nenhum link ainda</strong>
          <span>Adicione seu WhatsApp, Instagram, cardápio ou qualquer endereço. Ele aparece na prévia na hora.</span>
          <button type="button" className="btn btn-primary" data-new-link>Adicionar o primeiro link</button>
        </div>
      )}
      <SortableLinks
        onReorder={actions.reorder}
        trackEvents={trackEvents}
        items={links.map((link) => ({
          id: link.id,
          label: link.title,
          node: (
            <LinkCard
              link={link}
              updateAction={actions.update}
              deleteAction={actions.remove}
              proLayouts={access.proLayouts}
              pixReadOnly={!access.pix?.business}
              trackEvents={trackEvents}
              onDraftChange={onDraftChange}
              onImageFile={onImageFile ? (file) => onImageFile(link.id, file) : undefined}
            />
          ),
        }))}
      />
    </>
  );
}
