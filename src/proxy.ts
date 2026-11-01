import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_LINK_COOKIE, LOGIN_LINK_MINUTES, LOGIN_LINK_PATH, LOGIN_LINK_TOKEN } from "@/lib/login-link";

const SESSION_COOKIE = "lb_session";
const LOGGED_COOKIE = "lb_logged";

/**
 * O link do e-mail traz o token na query. Este GET não consome o token: guarda num cookie
 * httpOnly e redireciona sem ele, para não ir parar no endereço, no histórico nem no PostHog.
 * Referrer-Policy no-referrer evita que o pedido seguinte carregue a URL com o token.
 */
function receiveLoginLink(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token === null) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.search = "";
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (LOGIN_LINK_TOKEN.test(token)) {
    response.cookies.set(LOGIN_LINK_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: LOGIN_LINK_PATH,
      maxAge: LOGIN_LINK_MINUTES * 60,
    });
  }
  return response;
}

// Checagem leve (só a presença do cookie); a sessão é validada no banco pelas páginas e actions.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/login/entrar") return receiveLoginLink(request);
  // /login/entrar/falha não exige sessão. Se o matcher um dia pegar o caminho, não manda para o login.
  if (request.nextUrl.pathname.startsWith("/login/")) return NextResponse.next();

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
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login/entrar"],
};
