import "server-only";

/**
 * Envio de e-mail transacional.
 * Com RESEND_API_KEY e MAIL_FROM definidos, envia pela API do Resend (https://resend.com).
 * Sem eles, fora de produção, só mostra o e-mail no terminal do servidor (útil para testar localmente).
 */

/** headers: cabeçalhos extras do e-mail (ex.: List-Unsubscribe nos e-mails recorrentes). */
type Mail = { to: string; subject: string; text: string; html: string; headers?: Record<string, string> };

export async function sendMail({ to, subject, text, html, headers }: Mail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      console.error("[mail] RESEND_API_KEY/MAIL_FROM não configurados; e-mail não enviado.");
      return false;
    }
    console.info(`\n[mail] (dev, não enviado) Para: ${to}\nAssunto: ${subject}\n\n${text}\n`);
    return true;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text, html, ...(headers && { headers }) }),
  });
  if (!res.ok) {
    console.error(`[mail] falha ao enviar (${res.status}): ${await res.text().catch(() => "")}`);
    return false;
  }
  return true;
}
