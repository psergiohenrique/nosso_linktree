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

type Props = {
  layout?: LinkLayout;
  size?: LinkSize;
  /** Modo controlado (playground): sem isso, os rádios vão no formulário do link com defaultChecked. */
  onChange?: (change: { layout?: LinkLayout; size?: LinkSize }) => void;
  /** Prefixo do name dos rádios, para vários links na mesma tela sem formulário próprio. */
  namePrefix?: string;
  /** Destaque e Bloco liberados (plano Pro). Sem eles, aparecem travados com a etiqueta Pro. */
  proLayouts?: boolean;
};

/** Formato e tamanho de um link. */
export default function LinkOptions({
  layout = "button",
  size = "md",
  onChange,
  namePrefix = "",
  proLayouts = true,
}: Props) {
  const radio = (field: "layout" | "size", value: string, current: string) =>
    onChange
      ? {
          name: `${namePrefix}${field}`,
          value,
          checked: current === value,
          onChange: () => onChange({ [field]: value }),
        }
      : { name: field, value, defaultChecked: current === value };

  return (
    <div className="link-options">
      <div>
        <span className="field-label">Formato</span>
        <div className="segmented segmented-sm" role="radiogroup" aria-label="Formato">
          {LINK_LAYOUTS.map((l) => {
            const locked = !proLayouts && l.value !== "button";
            return (
              <label
                key={l.value}
                title={locked ? `${l.hint} (plano Pro)` : l.hint}
                className={locked ? "locked" : undefined}
              >
                <input
                  type="radio"
                  {...radio("layout", l.value, proLayouts ? layout : "button")}
                  disabled={locked}
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  {LAYOUT_ICONS[l.value]}
                </svg>
                {l.label}
                {locked && <span className="pro-tag">Pro</span>}
              </label>
            );
          })}
        </div>
      </div>
      <div>
        <span className="field-label">Tamanho</span>
        <div className="segmented segmented-sm" role="radiogroup" aria-label="Tamanho">
          {LINK_SIZES.map((s) => (
            <label key={s.value}>
              <input type="radio" {...radio("size", s.value, size)} />
              {s.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
