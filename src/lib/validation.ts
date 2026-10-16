export const RESERVED_SLUGS = new Set([
  'login',
  'dashboard',
  'go',
  'api',
  'auth',
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

export function validAccent(raw: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : '#4f46e5';
}
