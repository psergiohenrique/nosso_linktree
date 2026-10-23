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

/** Limite da coluna links.url no banco. */
export const MAX_URL_LENGTH = 2048;

/** Retorna a URL normalizada ou null se for inválida/insegura (ou maior que o banco aceita). */
export function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    const href = url.toString();
    return ALLOWED_PROTOCOLS.has(url.protocol) && href.length <= MAX_URL_LENGTH ? href : null;
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

/**
 * Usuário do Instagram a partir de "@fulana", "fulana" ou do link do perfil.
 * "" se vazio; null se inválido.
 */
export function instagramHandle(raw: string): string | null {
  let value = raw.trim();
  if (!value) return '';
  const fromUrl = value.match(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#]+)/i);
  if (fromUrl) value = fromUrl[1];
  value = value.replace(/^@/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(value) ? value : null;
}

/** Cor hexadecimal #rrggbb em minúsculas, ou o valor padrão. */
export function validColor(raw: unknown, fallback: string): string {
  const value = String(raw ?? '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(value) ? value : fallback;
}

export function oneOf<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}
