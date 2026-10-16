export const RESERVED_SLUGS = new Set([
  'login',
  'dashboard',
  'go',
  'api',
  'auth',
  'media',
  'cadastro',
  'demo',
  'admin',
  'app',
  'www',
  'static',
  'pricing',
  'precos',
  'termos',
  'privacidade',
]);

export function validateSlug(raw: string): string | null {
  const slug = raw.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,30}$/.test(slug)) return null;
  if (RESERVED_SLUGS.has(slug)) return null;
  return slug;
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'tel:', 'mailto:']);

/** Retorna a URL normalizada ou null se for inválida/insegura. */
export function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Monta o link wa.me a partir de um telefone (com ou sem DDI) e mensagem. */
export function whatsappUrl(phone: string, message: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 15) return null;
  const text = message.trim();
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Cor hexadecimal #rrggbb em minúsculas, ou o valor padrão. */
export function validColor(raw: unknown, fallback: string): string {
  const value = String(raw ?? '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(value) ? value : fallback;
}

export function oneOf<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}
