import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "lb_session";

// Checagem leve (só a presença do cookie); a sessão é validada no banco pelas páginas e actions.
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
