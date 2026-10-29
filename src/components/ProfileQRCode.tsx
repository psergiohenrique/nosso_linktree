import QRCode from "qrcode";
import { SITE_URL } from "@/lib/site";

export default async function ProfileQRCode({ slug }: { slug: string }) {
  const url = `${SITE_URL}/${slug}`;
  const image = await QRCode.toDataURL(url, { width: 512, margin: 4, errorCorrectionLevel: "M" });

  return (
    <section className="card qr-card" aria-labelledby="qr-title">
      <div className="qr-copy">
        <h2 id="qr-title" className="card-title">QR code da sua página</h2>
        <p className="hint">Compartilhe sua página em cartazes, cartões ou nas redes sociais.</p>
        <a href={url} target="_blank" rel="noreferrer" className="qr-url">{url}</a>
        <p className="hint">Se você mudar seu endereço, baixe um novo QR code: os materiais impressos não mudam sozinhos.</p>
        <a href={image} download={`qrcode-${slug}.png`} className="btn btn-outline btn-sm">Baixar QR code</a>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={`QR code para ${url}`} width={160} height={160} className="qr-image" />
    </section>
  );
}
