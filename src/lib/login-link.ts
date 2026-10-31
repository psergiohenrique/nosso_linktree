/** Cookie httpOnly com o token do link mágico. O proxy e as actions usam o mesmo nome. */
export const LOGIN_LINK_COOKIE = "lb_magic";

/** Validade do link. É login, não troca de senha (a recuperação usa 60 minutos). */
export const LOGIN_LINK_MINUTES = 15;

/** base64url de 32 bytes. Fora disso o proxy nem grava o cookie. */
export const LOGIN_LINK_TOKEN = /^[A-Za-z0-9_-]{20,100}$/;

/** Esconde o usuário do e-mail: "maria@gmail.com" vira "m***@gmail.com". */
export function maskEmail(email: string) {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return "***";
  return `${email.slice(0, 1)}***@${email.slice(at + 1)}`;
}
