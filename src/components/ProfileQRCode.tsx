import QRCode from "qrcode";
import { SITE_URL } from "@/lib/site";

export default async function ProfileQRCode({ slug }: { slug: string }) {
  const url = `${SITE_URL}/${slug}`;
  const image = await QRCode.toDataURL(url, { width: 512, margin: 4, errorCorrectionLevel: "M" });

  return (
    <section className="card qr-card" aria-labelledby="qr-title">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={`QR code para ${url}`} width={128} height={128} className="qr-image" />
      <div className="qr-copy">
        <h2 id="qr-title" className="card-title">QR code da sua página</h2>
        <a href={url} target="_blank" rel="noreferrer" className="qr-url">{url.replace(/^https?:\/\//, "")}</a>
        <p className="hint">Para cartazes, cartões e redes sociais. Se mudar seu endereço, baixe um novo: o impresso não muda sozinho.</p>
        <a href={image} download={`qrcode-${slug}.png`} className="btn btn-outline btn-sm">Baixar QR code</a>
      </div>
    </section>
  );
}
