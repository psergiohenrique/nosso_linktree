import QRCode from "qrcode";

/**
 * QR do BR Code, SVG preto no branco, zona quieta de 4 módulos.
 * Gerado no servidor: a página pública não precisa da lib no navegador.
 * O SVG só tem retângulos da matriz; nenhum texto do usuário entra aqui.
 */
export function pixQrSvg(payload: string): string {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const quiet = 4;
  const dim = size + quiet * 2;
  let rects = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.modules.get(x, y)) rects += `<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" role="img" aria-label="QR Code Pix"><rect width="${dim}" height="${dim}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
