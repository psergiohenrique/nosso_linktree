import { ImageResponse } from "next/og";
import sharp from "sharp";
import { truncate, profileName } from "@/lib/seo";
import { SITE_HOST } from "@/lib/site";
import { getPlan } from "@/server/billing";
import { getMedia } from "@/server/media";
import { getPublicPage } from "@/server/profiles";

// Imagem de compartilhamento (WhatsApp, Instagram, Facebook, X) de cada página, nas cores dela.
export const alt = "Página de links no Linkbio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// O painel também invalida esta rota ao salvar; isto é só o teto.
export const revalidate = 3600;

/** Foto como PNG em data URL: o next/og não lê WebP, que é o formato da maioria das fotos enviadas. */
async function avatarDataUrl(id: string | null) {
  if (!id) return null;
  const media = await getMedia(id);
  if (!media) return null;
  try {
    const png = await sharp(media.bytes).resize(440, 440, { fit: "cover" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getPublicPage((await params).slug);
  if (!data) return new Response("Não encontrado", { status: 404 });

  const { profile } = data;
  const [avatar, plan] = await Promise.all([avatarDataUrl(profile.avatar_id), getPlan(profile.id)]);
  const name = profileName(profile);
  const bio = profile.bio.trim() ? truncate(profile.bio, 110) : "";
  const background =
    profile.bg_type === "gradient"
      ? `linear-gradient(135deg, ${profile.bg_color} 0%, ${profile.bg_color2} 100%)`
      : profile.bg_color;
  const initialBg = profile.initial_bg_color ?? profile.button_color;
  const initialText = profile.initial_text_color ?? profile.button_text_color;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: "64px",
          padding: "72px 88px",
          background,
          color: profile.text_color,
          position: "relative",
        }}
      >
        {avatar ? (
          <img src={avatar} width={220} height={220} alt="" style={{ borderRadius: "50%", flexShrink: 0 }} />
        ) : (
          <div
            style={{
              width: "220px",
              height: "220px",
              borderRadius: "50%",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: initialBg,
              color: initialText,
              fontSize: "110px",
              fontWeight: 800,
            }}
          >
            {name.replace("@", "").charAt(0).toUpperCase()}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "22px", flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: name.length > 22 ? "60px" : "80px",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
            }}
          >
            {truncate(name, 48)}
          </div>
          {bio && <div style={{ fontSize: "30px", lineHeight: 1.35, opacity: 0.85 }}>{bio}</div>}
          <div style={{ display: "flex" }}>
            <div
              style={{
                display: "flex",
                fontSize: "26px",
                fontWeight: 700,
                padding: "12px 26px",
                borderRadius: "999px",
                background: profile.button_color,
                color: profile.button_text_color,
              }}
            >
              {SITE_HOST}/{profile.slug}
            </div>
          </div>
        </div>

        {!plan.pro && (
          <div style={{ position: "absolute", right: "40px", bottom: "28px", fontSize: "22px", opacity: 0.6 }}>
            Feito com Linkbio
          </div>
        )}
      </div>
    ),
    size,
  );
}
