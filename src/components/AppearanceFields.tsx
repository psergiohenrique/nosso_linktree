"use client";

import { BUTTON_STYLES, FONTS, THEME_PRESETS, type Appearance } from "@/lib/types";
import { pageViewStyle, type PageViewProfile } from "./PageView";

const COLOR_FIELDS: { name: keyof Appearance; label: string }[] = [
  { name: "text_color", label: "Texto" },
  { name: "button_color", label: "Botão" },
  { name: "button_text_color", label: "Texto do botão" },
];

type Props = {
  state: PageViewProfile;
  setState: React.Dispatch<React.SetStateAction<PageViewProfile>>;
  avatarUrl: string | null;
  onAvatarFile: (file: File | null) => void;
  onRemoveAvatar: () => void;
};

/** Controles de perfil e aparência (usados pelo editor do painel e pelo playground do /demo). */
export default function AppearanceFields({ state, setState, avatarUrl, onAvatarFile, onRemoveAvatar }: Props) {
  const set = <K extends keyof PageViewProfile>(key: K, value: PageViewProfile[K]) =>
    setState((s) => ({ ...s, [key]: value }));
  const initialCustom = state.initial_bg_color != null || state.initial_text_color != null;

  return (
    <>
    <section className="card">
      <h2 className="card-title">Perfil</h2>
      <div className="avatar-row">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" width={72} height={72} className="avatar-edit" />
        ) : (
          <div className="avatar-edit avatar-edit-empty" aria-hidden="true">
            {(state.display_name || state.slug).charAt(0).toUpperCase()}
          </div>
        )}
        <div className="avatar-actions">
          <label className="btn btn-outline btn-sm file-btn">
            {avatarUrl ? "Trocar foto" : "Enviar foto"}
            <input
              type="file"
              name="avatar"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => onAvatarFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {avatarUrl && (
            <button type="button" className="btn btn-outline btn-sm btn-danger" onClick={onRemoveAvatar}>
              Remover
            </button>
          )}
          <span className="hint">PNG, JPG, WEBP ou GIF até 2 MB</span>
        </div>
      </div>
      <input
        name="display_name"
        value={state.display_name}
        onChange={(e) => set("display_name", e.target.value)}
        maxLength={60}
        placeholder="Nome"
        aria-label="Nome"
        className="field"
      />
      <textarea
        name="bio"
        value={state.bio}
        onChange={(e) => set("bio", e.target.value)}
        maxLength={200}
        rows={2}
        placeholder="Bio"
        aria-label="Bio"
        className="field"
      />
    </section>

    <section className="card">
      <h2 className="card-title">Temas prontos</h2>
      <div className="presets">
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className="preset"
            onClick={() => setState((s) => ({ ...s, ...preset.appearance }))}
          >
            <span className="preset-swatch" style={pageViewStyle(preset.appearance)}>
              <span className="preset-btn" />
              <span className="preset-btn" />
            </span>
            {preset.name}
          </button>
        ))}
      </div>
    </section>

    <section className="card">
      <h2 className="card-title">Fundo</h2>
      <div className="segmented" role="radiogroup" aria-label="Tipo de fundo">
        {(["solid", "gradient"] as const).map((type) => (
          <label key={type} className={state.bg_type === type ? "active" : ""}>
            <input
              type="radio"
              name="bg_type"
              value={type}
              checked={state.bg_type === type}
              onChange={() => set("bg_type", type)}
            />
            {type === "solid" ? "Cor sólida" : "Degradê"}
          </label>
        ))}
      </div>
      <div className="color-grid">
        <label className="color-field">
          <input type="color" name="bg_color" value={state.bg_color} onChange={(e) => set("bg_color", e.target.value)} />
          {state.bg_type === "gradient" ? "Cor de cima" : "Cor do fundo"}
        </label>
        {state.bg_type === "gradient" ? (
          <label className="color-field">
            <input type="color" name="bg_color2" value={state.bg_color2} onChange={(e) => set("bg_color2", e.target.value)} />
            Cor de baixo
          </label>
        ) : (
          <input type="hidden" name="bg_color2" value={state.bg_color2} />
        )}
      </div>
    </section>

    <section className="card">
      <h2 className="card-title">Botões</h2>
      <div className="segmented segmented-wrap" role="radiogroup" aria-label="Estilo do botão">
        {BUTTON_STYLES.map((b) => (
          <label key={b.value} className={state.button_style === b.value ? "active" : ""}>
            <input
              type="radio"
              name="button_style"
              value={b.value}
              checked={state.button_style === b.value}
              onChange={() => set("button_style", b.value)}
            />
            {b.label}
          </label>
        ))}
      </div>
      <div className="color-grid">
        {COLOR_FIELDS.map((f) => (
          <label key={f.name} className="color-field">
            <input
              type="color"
              name={f.name}
              value={state[f.name] as string}
              onChange={(e) => set(f.name, e.target.value)}
            />
            {f.label}
          </label>
        ))}
      </div>
      <p className="hint">O botão de WhatsApp fica sempre verde, a cor que as pessoas reconhecem.</p>
    </section>

    <section className="card">
      <h2 className="card-title">Círculo da inicial</h2>
      <p className="hint">
        {avatarUrl
          ? "Aparece no lugar da foto. Como você enviou uma foto, ele só é usado se você a remover."
          : "Aparece no lugar da foto, com a primeira letra do seu nome."}
      </p>
      <div className="initial-row">
        <span className="initial-sample" style={pageViewStyle(state)} aria-hidden="true">
          {(state.display_name || state.slug).charAt(0).toUpperCase()}
        </span>
        <label className="check">
          <input
            type="checkbox"
            checked={!initialCustom}
            onChange={(e) =>
              setState((s) =>
                e.target.checked
                  ? { ...s, initial_bg_color: null, initial_text_color: null }
                  : { ...s, initial_bg_color: s.button_color, initial_text_color: s.button_text_color },
              )
            }
          />
          Usar as cores do botão
        </label>
      </div>
      <input type="hidden" name="initial_custom" value={initialCustom ? "1" : ""} />
      {initialCustom && (
        <div className="color-grid">
          <label className="color-field">
            <input
              type="color"
              name="initial_bg_color"
              value={state.initial_bg_color ?? state.button_color}
              onChange={(e) => set("initial_bg_color", e.target.value)}
            />
            Fundo do círculo
          </label>
          <label className="color-field">
            <input
              type="color"
              name="initial_text_color"
              value={state.initial_text_color ?? state.button_text_color}
              onChange={(e) => set("initial_text_color", e.target.value)}
            />
            Letra
          </label>
        </div>
      )}
    </section>

    <section className="card">
      <h2 className="card-title">Fonte</h2>
      <div className="font-grid" role="radiogroup" aria-label="Fonte">
        {FONTS.map((f) => (
          <label key={f.value} className={`font-option bio-font-${f.value} ${state.font === f.value ? "active" : ""}`}>
            <input
              type="radio"
              name="font"
              value={f.value}
              checked={state.font === f.value}
              onChange={() => set("font", f.value)}
            />
            <span className="font-sample">Aa</span>
            {f.label}
          </label>
        ))}
      </div>
    </section>
    </>
  );
}
