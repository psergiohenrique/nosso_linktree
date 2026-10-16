import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Linkbio by CodePath — Seu link na bio, feito para vender no WhatsApp";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#f4f2ec",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "-160px",
            top: "-120px",
            width: "720px",
            height: "720px",
            borderRadius: "50%",
            background: "radial-gradient(circle, #c8f169 0%, rgba(200,241,105,0) 65%)",
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 80px",
            height: "100%",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                background: "#17181a",
                display: "flex",
                position: "relative",
              }}
            >
              <div style={{ position: "absolute", left: "16px", top: "12px", width: "9px", height: "32px", borderRadius: "5px", background: "#c8f169" }} />
              <div style={{ position: "absolute", left: "16px", top: "35px", width: "25px", height: "9px", borderRadius: "5px", background: "#c8f169" }} />
            </div>
            <span style={{ fontSize: "30px", fontWeight: 800, color: "#17181a" }}>Linkbio</span>
            <span style={{ fontSize: "22px", fontWeight: 600, color: "#5c5f66", marginTop: "8px" }}>by CodePath</span>
          </div>

          <div
            style={{
              fontSize: "76px",
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              color: "#17181a",
              maxWidth: "860px",
            }}
          >
            Seu link na bio, feito para vender no WhatsApp
          </div>

          <div style={{ display: "flex", gap: "20px", fontSize: "22px", color: "#6b6d70" }}>
            <span>Botão de WhatsApp</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>Métricas de cliques</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>0% de comissão</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
