// Quem é administrador: lista de e-mails em ADMIN_EMAILS (separados por vírgula, espaço ou ponto e vírgula).

export function parseAdminEmails(raw: string | undefined) {
  return new Set(
    (raw ?? "")
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );
}

export function isAdminEmail(email: string, raw: string | undefined) {
  return parseAdminEmails(raw).has(email.toLowerCase());
}
