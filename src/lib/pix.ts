// Pix estático: a chave é do próprio negócio. O Linkbio só monta o BR Code (copia-e-cola);
// não custodia o pagamento. Formato EMV do Manual de Padrões para Iniciação do Pix:
// TLV, GUI br.gov.bcb.pix, iniciação "11" (reutilizável), sem valor, txid "***", CRC16.
import { hasTier, type PlanState } from "./billing";

/** Liga o bloco Pix. Fora de "true", ninguém vê nem grava. Não tem preço: o checkout do Business continua desligado. */
export function pixEnabled() {
  return process.env.PIX_ENABLED === "true";
}

/** O bloco entra na página só no Business, e só com o recurso ligado. */
export function pixOnPage(plan: PlanState) {
  return pixEnabled() && hasTier(plan, "business");
}

const GUI = "br.gov.bcb.pix";

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), o CRC16 do BR Code. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(id: string, value: string) {
  if (value.length > 99) return null;
  return id + String(value.length).padStart(2, "0") + value;
}

function cpfDigitsOk(digits: string) {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

function cnpjDigitsOk(digits: string) {
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, weight, i) => acc + Number(digits[i]) * weight, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  return calc(12) === Number(digits[12]) && calc(13) === Number(digits[13]);
}

/** Telefone brasileiro já com DDI 55, no formato E.164 da chave Pix (+55…). */
function phoneKey(digits: string) {
  // DDD + celular (9 + 8 dígitos) ou DDD + fixo (8 dígitos, primeiro 2–9).
  if (!/^55[1-9]{2}(?:9\d{8}|[2-9]\d{7})$/.test(digits)) return null;
  return `+${digits}`;
}

/**
 * Chave Pix canônica, ou null se não for CPF, CNPJ, e-mail, celular ou chave aleatória.
 * Onze dígitos que passam no CPF ficam CPF; celular sem DDI precisa do 9 na frente
 * (ou começar com +55) para não ser confundido com um CPF.
 */
export function normalizePixKey(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.includes("@")) {
    const email = value.toLowerCase();
    if (email.length > 77 || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return null;
    return email;
  }

  const hex = value.replace(/-/g, "");
  if (/^[0-9a-f]{32}$/i.test(hex) && (value.includes("-") || hex.length === 32)) {
    const id = hex.toLowerCase();
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  }

  if (value.startsWith("+")) {
    return phoneKey(value.replace(/\D/g, ""));
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && cpfDigitsOk(digits)) return digits;
  if (digits.length === 11 && /^[1-9]{2}9\d{8}$/.test(digits)) return phoneKey(`55${digits}`);
  if (digits.length === 10 && /^[1-9]{2}[2-9]\d{7}$/.test(digits)) return phoneKey(`55${digits}`);
  if (digits.length === 14 && cnpjDigitsOk(digits)) return digits;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return phoneKey(digits);
  return null;
}

/** Nome ou cidade do recebedor no BR Code: sem acento, maiúsculas, tamanho do EMV. */
export function pixMerchant(raw: string, max: number): string | null {
  const cleaned = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max);
  return cleaned.length > 0 ? cleaned : null;
}

/** BR Code estático (sem valor). Null se a chave ou o recebedor não servem. */
export function pixPayload(input: { key: string; merchantName: string; merchantCity: string }): string | null {
  const key = normalizePixKey(input.key);
  const name = pixMerchant(input.merchantName, 25);
  const city = pixMerchant(input.merchantCity, 15);
  if (!key || !name || !city) return null;

  const account = tlv("00", GUI)! + tlv("01", key)!;
  const body = [
    tlv("00", "01"),
    tlv("01", "11"),
    tlv("26", account),
    tlv("52", "0000"),
    tlv("53", "986"),
    tlv("58", "BR"),
    tlv("59", name),
    tlv("60", city),
    tlv("62", tlv("05", "***")!),
  ].join("");
  const withCrcTag = body + "6304";
  return withCrcTag + crc16(withCrcTag);
}

export function isValidPixPayload(payload: string) {
  if (payload.length < 8 || !payload.slice(0, -4).endsWith("6304")) return false;
  return crc16(payload.slice(0, -4)) === payload.slice(-4).toUpperCase();
}

/** BR Code a partir do que está no banco. Null se a chave ou o config não fecham. */
export function tryPixPayload(key: string, config: unknown): string | null {
  if (!config || typeof config !== "object") return null;
  const row = config as { merchantName?: unknown; merchantCity?: unknown };
  if (typeof row.merchantName !== "string" || typeof row.merchantCity !== "string") return null;
  return pixPayload({ key, merchantName: row.merchantName, merchantCity: row.merchantCity });
}
