import { ImageResponse } from "next/og";

// Ícone da tela inicial do iPhone (o Safari não usa o icon.svg). Mesmo desenho do LogoMark.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#17181a", position: "relative" }}>
        <div style={{ position: "absolute", left: "51px", top: "39px", width: "28px", height: "101px", borderRadius: "14px", background: "#c8f169" }} />
        <div style={{ position: "absolute", left: "51px", top: "112px", width: "79px", height: "28px", borderRadius: "14px", background: "#c8f169" }} />
      </div>
    ),
    size,
  );
}
