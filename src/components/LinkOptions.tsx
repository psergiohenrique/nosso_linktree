import { LINK_LAYOUTS, LINK_SIZES, type LinkLayout, type LinkSize } from "@/lib/types";

const LAYOUT_ICONS: Record<LinkLayout, React.ReactNode> = {
  button: <rect x="3" y="9" width="18" height="6" rx="3" />,
  featured: (
    <>
      <rect x="4" y="3" width="16" height="11" rx="2" />
      <rect x="4" y="16" width="16" height="5" rx="2" />
    </>
  ),
  tile: (
    <>
      <rect x="3" y="6" width="8" height="8" rx="2" />
      <rect x="13" y="6" width="8" height="8" rx="2" />
    </>
  ),
};

/** Formato e tamanho de um link (rádios dentro do formulário do link). */
export default function LinkOptions({ layout = "button", size = "md" }: { layout?: LinkLayout; size?: LinkSize }) {
  return (
    <div className="link-options">
      <div>
        <span className="field-label">Formato</span>
        <div className="segmented segmented-sm" role="radiogroup" aria-label="Formato">
          {LINK_LAYOUTS.map((l) => (
            <label key={l.value} title={l.hint}>
              <input type="radio" name="layout" value={l.value} defaultChecked={layout === l.value} />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                {LAYOUT_ICONS[l.value]}
              </svg>
              {l.label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <span className="field-label">Tamanho</span>
        <div className="segmented segmented-sm" role="radiogroup" aria-label="Tamanho">
          {LINK_SIZES.map((s) => (
            <label key={s.value}>
              <input type="radio" name="size" value={s.value} defaultChecked={size === s.value} />
              {s.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
