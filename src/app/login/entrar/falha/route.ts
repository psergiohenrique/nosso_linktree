import { after, NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { LOGIN_LINK_COOKIE, LOGIN_LINK_PATH } from "@/lib/login-link";
import { findLoginLink } from "@/server/auth";
import { captureAuthEvent } from "@/server/posthog-events";

export const dynamic = "force-dynamic";

/**
 * Link vencido ou já usado: registra o motivo (sem token) e apaga o cookie,
 * para um refresh não contar de novo. O GET do e-mail em si não passa aqui.
 */
export async function GET(request: NextRequest) {
  const token = (await cookies()).get(LOGIN_LINK_COOKIE)?.value ?? "";
  const response = NextResponse.redirect(new URL("/login/entrar", request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");

  if (!token) return response;
  const link = await findLoginLink(token);
  if (link.status === "valid") return response;

  response.cookies.set(LOGIN_LINK_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: LOGIN_LINK_PATH,
    maxAge: 0,
  });
  after(() =>
    captureAuthEvent({
      event: "magic_link_login_failed",
      distinctId: link.userId ?? "",
      reason: link.status,
    }),
  );
  return response;
}
