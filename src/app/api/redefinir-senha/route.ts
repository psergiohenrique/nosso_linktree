import { NextResponse, type NextRequest } from "next/server";
import { RESET_COOKIE } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * Destino do link enviado por e-mail. Guarda o token num cookie httpOnly e redireciona para
 * /login/redefinir, para o token não ficar na barra de endereço, no histórico nem em scripts de analytics.
 */
export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const response = NextResponse.redirect(new URL("/login/redefinir", request.url));
  if (/^[A-Za-z0-9_-]{20,100}$/.test(token)) {
    response.cookies.set(RESET_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    });
  }
  return response;
}
