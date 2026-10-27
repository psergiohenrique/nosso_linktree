import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "lb_session";
const LOGGED_COOKIE = "lb_logged";

// Checagem leve (só a presença do cookie); a sessão é validada no banco pelas páginas e actions.
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const response = NextResponse.next();
  // Sessões de antes do lb_logged: ganham o aviso ao abrir o painel.
  if (!request.cookies.has(LOGGED_COOKIE)) {
    response.cookies.set(LOGGED_COOKIE, "1", {
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
