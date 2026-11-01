import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { pixQrSvg } from "@/lib/pix-qr";
import { crc16, isValidPixPayload, normalizePixKey, pixMerchant, pixPayload, tryPixPayload } from "@/lib/pix";

function tlv(payload: string) {
  const fields: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    if (!Number.isInteger(len) || i + 4 + len > payload.length) break;
    fields[id] = payload.slice(i + 4, i + 4 + len);
    i += 4 + len;
    if (id === "63") break;
  }
  return fields;
}

describe("chave Pix", () => {
  it("aceita CPF, CNPJ, e-mail, celular e chave aleatória", () => {
    expect(normalizePixKey("111.444.777-35")).toBe("11144477735");
    expect(normalizePixKey("11.444.777/0001-61")).toBe("11444777000161");
    expect(normalizePixKey("Loja@Exemplo.com")).toBe("loja@exemplo.com");
    expect(normalizePixKey("+55 (11) 98888-7777")).toBe("+5511988887777");
    expect(normalizePixKey("11988887777")).toBe("+5511988887777");
    expect(normalizePixKey("1133334444")).toBe("+551133334444");
    expect(normalizePixKey("123E4567-E12B-12D1-A456-426655440000")).toBe("123e4567-e12b-12d1-a456-426655440000");
  });

  it("não transforma um CPF válido em telefone", () => {
    expect(normalizePixKey("11144477735")).toBe("11144477735");
  });

  it("recusa o que não é chave", () => {
    expect(normalizePixKey("")).toBeNull();
    expect(normalizePixKey("não é chave")).toBeNull();
    expect(normalizePixKey("000.000.000-00")).toBeNull();
    expect(normalizePixKey("111.444.777/0001-00")).toBeNull();
    expect(normalizePixKey("email-sem-arroba.com")).toBeNull();
    expect(normalizePixKey("+1 202 555 0143")).toBeNull();
  });
});

describe("BR Code estático", () => {
  const key = "11144477735";
  const code = pixPayload({ key, merchantName: "Fulano de Tal", merchantCity: "Brasília" })!;

  it("calcula o CRC16-CCITT", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  describe("BR Code de referência do Manual do BACEN", () => {
    // Exemplo estático do Manual de Padrões para Iniciação do Pix: chave aleatória, "Fulano de Tal",
    // BRASILIA, txid "***", sem valor. O CRC oficial é 1D3D.
    const officialBody =
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
    const official = `${officialBody}1D3D`;
    const input = { key: "123e4567-e12b-12d1-a456-426655440000", merchantName: "Fulano de Tal", merchantCity: "BRASILIA" };

    it("o CRC16 do payload oficial (sem os 4 últimos dígitos) é 1D3D", () => {
      expect(crc16(officialBody)).toBe("1D3D");
      expect(isValidPixPayload(official)).toBe(true);
      // Um dígito trocado quebra a validação.
      expect(isValidPixPayload(official.replace("Fulano", "Fulana"))).toBe(false);
    });

    it("o gerador só difere do exemplo no que o nosso formato define: iniciação 11 e nome em maiúsculas", () => {
      // O gerador não reproduz o exemplo byte a byte: marca o código como reutilizável (campo 01 = "11")
      // e grava o nome em maiúsculas e sem acento. O resto (chave, GUI, MCC, moeda, país, cidade, txid) é igual.
      const generated = pixPayload(input)!;
      const sameLayout = officialBody.replace("000201", "000201010211").replace("Fulano de Tal", "FULANO DE TAL");
      expect(generated).toBe(sameLayout + crc16(sameLayout));
      expect(isValidPixPayload(generated)).toBe(true);

      const { "01": init, "59": name, "63": crc, ...rest } = tlv(generated);
      const { "01": noInit, "59": officialName, "63": officialCrc, ...officialRest } = tlv(official);
      expect(init).toBe("11");
      expect(noInit).toBeUndefined();
      expect(name).toBe(officialName.toUpperCase());
      expect(crc).not.toBe(officialCrc);
      expect(rest).toEqual(officialRest);
    });
  });

  it("monta o EMV sem valor, com a chave e o CRC", () => {
    expect(code).toBeTruthy();
    expect(isValidPixPayload(code)).toBe(true);
    const fields = tlv(code);
    expect(fields["00"]).toBe("01");
    expect(fields["01"]).toBe("11");
    expect(fields["52"]).toBe("0000");
    expect(fields["53"]).toBe("986");
    expect(fields["54"]).toBeUndefined();
    expect(fields["58"]).toBe("BR");
    expect(fields["59"]).toBe("FULANO DE TAL");
    expect(fields["60"]).toBe("BRASILIA");
    expect(tlv(fields["62"])["05"]).toBe("***");
    const account = tlv(fields["26"]);
    expect(account["00"]).toBe("br.gov.bcb.pix");
    expect(account["01"]).toBe(key);
    expect(fields["63"]).toBe(crc16(code.slice(0, -4)));
    expect(code.endsWith(fields["63"])).toBe(true);
  });

  it("recusa um código com o CRC alterado", () => {
    const broken = code.slice(0, -4) + (code.endsWith("0") ? "1" : "0").repeat(4);
    expect(isValidPixPayload(broken)).toBe(false);
  });

  it("tira acento e corta nome e cidade no limite do EMV", () => {
    expect(pixMerchant("São Paulo", 15)).toBe("SAO PAULO");
    expect(pixMerchant("Açaí & Café do Centro da Cidade", 25)).toBe("ACAI CAFE DO CENTRO DA CI");
    expect(pixMerchant("!!!", 25)).toBeNull();
    expect(pixPayload({ key, merchantName: "!!!", merchantCity: "São Paulo" })).toBeNull();
  });

  it("lê o config gravado no link", () => {
    expect(tryPixPayload(key, { merchantName: "Fulano de Tal", merchantCity: "Brasília" })).toBe(code);
    expect(tryPixPayload(key, null)).toBeNull();
    expect(tryPixPayload("não é chave", { merchantName: "Fulano", merchantCity: "Osasco" })).toBeNull();
  });

  it("o QR entrega o mesmo BR Code que o copia-e-cola", async () => {
    const dataUrl = await QRCode.toDataURL(code, { errorCorrectionLevel: "M", margin: 4, width: 280 });
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const png = PNG.sync.read(Buffer.from(base64, "base64"));
    expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(code);
    const svg = pixQrSvg(code);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toContain(key);
    expect(svg).toContain('fill="#000"');
  });
});
