"use client";

import { BUTTON_STYLES, FONTS, THEME_PRESETS, WHATSAPP_STYLES, type Appearance } from "@/lib/types";
import ImageInput from "./ImageInput";
import Section from "./Section";
import { pageViewStyle, WhatsappIcon, type PageViewProfile } from "./PageView";

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
  coverImageUrl: string | null;
  onCoverImageFile: (file: File | null) => void;
  onRemoveCoverImage: () => void;
  /** Bloco de redes sociais inserido pela composição compartilhada AppearanceSections. */
  afterProfile?: React.ReactNode;
};

/** Controles de perfil e aparência (usados pelo editor do painel e pelo playground do /demo). */
export default function AppearanceFields({
  state,
  setState,
  avatarUrl,
  onAvatarFile,
  onRemoveAvatar,
  coverImageUrl,
  onCoverImageFile,
  onRemoveCoverImage,
  afterProfile,
}: Props) {
  const set = <K extends keyof PageViewProfile>(key: K, value: PageViewProfile[K]) =>
    setState((s) => ({ ...s, [key]: value }));
  const initialCustom = state.initial_bg_color != null || state.initial_text_color != null;

  return (
    <>
    <Section id="perfil" title="Perfil" collapsible defaultOpen>
      <div className="profile-head">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" width={72} height={72} className="avatar-edit" />
        ) : (
          <div className="avatar-edit avatar-edit-empty" aria-hidden="true">
            {(state.display_name || state.slug).charAt(0).toUpperCase()}
          </div>
        )}
        <div className="profile-head-main">
          <div>
            <label className="field-label" htmlFor="profile-name">Nome</label>
            <input
              id="profile-name"
              name="display_name"
              value={state.display_name}
              onChange={(e) => set("display_name", e.target.value)}
              maxLength={60}
              placeholder="Nome do seu negócio"
              className="field"
            />
          </div>
          <div className="avatar-actions">
            <label className="btn btn-outline btn-sm file-btn">
              {avatarUrl ? "Trocar foto" : "Enviar foto"}
              <ImageInput name="avatar" onFile={onAvatarFile} />
            </label>
            {avatarUrl && (
              <button type="button" className="btn btn-outline btn-sm btn-danger" onClick={onRemoveAvatar}>
                Remover
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="field-label-row">
          <label className="field-label" htmlFor="profile-bio">Bio</label>
          <span className="field-count">{state.bio.length}/200</span>
        </div>
        <textarea
          id="profile-bio"
          name="bio"
          value={state.bio}
          onChange={(e) => set("bio", e.target.value)}
          maxLength={200}
          rows={3}
          placeholder="Uma frase sobre você ou seu negócio"
          className="field"
        />
      </div>

      <div>
        <span className="field-label">
          Foto de capa <span className="field-optional">(opcional)</span>
        </span>
        {coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImageUrl} alt="Prévia da foto de capa" className="cover-edit" />
        )}
        <div className="avatar-actions">
          <label className="btn btn-outline btn-sm file-btn">
            {coverImageUrl ? "Trocar capa" : "Enviar capa"}
            <ImageInput name="cover_image" onFile={onCoverImageFile} />
          </label>
          {coverImageUrl && (
            <button type="button" className="btn btn-outline btn-sm btn-danger" onClick={onRemoveCoverImage}>
              Remover
            </button>
          )}
        </div>
        <p className="hint profile-hint">Melhor se for horizontal. PNG, JPG, WEBP ou GIF; fotos grandes são reduzidas sozinhas.</p>
      </div>

      <label className="card-switch profile-switch">
        <span className="switch">
          <input type="checkbox" name="show_avatar" value="1" checked={state.show_avatar} onChange={(e) => set("show_avatar", e.target.checked)} />
          <span className="switch-track" />
        </span>
        Mostrar foto (ou a inicial) na página
      </label>

      <input type="hidden" name="initial_custom" value={initialCustom ? "1" : ""} />
      {avatarUrl ? (
        // Com foto o círculo da inicial não aparece; só preserva as cores já escolhidas.
        initialCustom && (
          <>
            <input type="hidden" name="initial_bg_color" value={state.initial_bg_color ?? state.button_color} />
            <input type="hidden" name="initial_text_color" value={state.initial_text_color ?? state.button_text_color} />
          </>
        )
      ) : (
        <>
          <h3 className="sec-sub">Círculo da inicial</h3>
          <p className="hint">Sem foto, a página mostra a primeira letra do seu nome.</p>
          <div className="initial-row">
            <span className="initial-sample" style={pageViewStyle(state)} aria-hidden="true">
              {(state.display_name || state.slug).charAt(0).toUpperCase()}
            </span>
            <label className="card-switch">
              <span className="switch">
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
                <span className="switch-track" />
              </span>
              Usar as cores do botão
            </label>
          </div>
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
        </>
      )}
    </Section>

    {afterProfile}

    <Section id="tema" title="Tema e cores" collapsible desktopOpen>
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
      <h3 className="sec-sub">Fundo</h3>
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
    </Section>

    <Section id="botoes" title="Botões" collapsible desktopOpen>
      <div className="style-grid" role="radiogroup" aria-label="Estilo do botão">
        {BUTTON_STYLES.map((b) => (
          <label key={b.value} className={`style-option${state.button_style === b.value ? " active" : ""}`}>
            <input
              type="radio"
              name="button_style"
              value={b.value}
              checked={state.button_style === b.value}
              onChange={() => set("button_style", b.value)}
            />
            {/* Amostra com as cores da página e o formato de cada estilo */}
            <span className={`style-stage bio-btn-${b.value}`} style={pageViewStyle(state)} aria-hidden="true">
              <span className="style-sample" />
            </span>
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
      <h3 className="sec-sub">Botão do WhatsApp</h3>
      <p className="hint">Os links de WhatsApp levam o ícone do WhatsApp no canto direito. Escolha a cor deles.</p>
      <div className="segmented segmented-wrap segmented-3" role="radiogroup" aria-label="Cor do botão do WhatsApp">
        {WHATSAPP_STYLES.map((w) => (
          <label key={w.value} className={state.whatsapp_style === w.value ? "active" : ""}>
            <input
              type="radio"
              name="whatsapp_style"
              value={w.value}
              checked={state.whatsapp_style === w.value}
              onChange={() =>
                setState((s) => ({
                  ...s,
                  whatsapp_style: w.value,
                  // Ao abrir "Cores próprias" pela primeira vez, parte das cores que o botão tinha.
                  ...(w.value === "custom" && s.whatsapp_style === "theme"
                    ? { whatsapp_color: s.button_color, whatsapp_text_color: s.button_text_color }
                    : {}),
                }))
              }
            />
            {w.label}
          </label>
        ))}
      </div>
      <div className="initial-row">
        <span className="whats-sample" style={pageViewStyle(state)} aria-hidden="true">
          WhatsApp
          <WhatsappIcon className="whats-sample-icon" />
        </span>
      </div>
      {state.whatsapp_style === "custom" ? (
        <div className="color-grid">
          <label className="color-field">
            <input
              type="color"
              name="whatsapp_color"
              value={state.whatsapp_color}
              onChange={(e) => set("whatsapp_color", e.target.value)}
            />
            Botão
          </label>
          <label className="color-field">
            <input
              type="color"
              name="whatsapp_text_color"
              value={state.whatsapp_text_color}
              onChange={(e) => set("whatsapp_text_color", e.target.value)}
            />
            Texto e ícone
          </label>
        </div>
      ) : (
        <>
          <input type="hidden" name="whatsapp_color" value={state.whatsapp_color} />
          <input type="hidden" name="whatsapp_text_color" value={state.whatsapp_text_color} />
        </>
      )}
    </Section>

    <Section id="fonte" title="Fonte" collapsible desktopOpen>
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
    </Section>
    </>
  );
}
