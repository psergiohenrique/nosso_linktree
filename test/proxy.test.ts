import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { LOGIN_LINK_COOKIE } from "@/lib/login-link";
import { proxy } from "@/proxy";

const TOKEN = "abcdefghijklmnopqrstuvwxyz012345";

function run(url: string, cookie?: string) {
  return proxy(new NextRequest(url, cookie ? { headers: { cookie } } : undefined));
}

describe("proxy do link mágico", () => {
  it("tira o token da URL e guarda num cookie httpOnly", () => {
    const res = run(`https://linkbio.dev.br/login/entrar?token=${TOKEN}`);
    expect(res.headers.get("location")).toBe("https://linkbio.dev.br/login/entrar");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${LOGIN_LINK_COOKIE}=${TOKEN}`);
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie).toContain("Max-Age=900");
    expect(res.headers.get("location")).not.toContain(TOKEN);
  });

  it("token malformado some da URL e não vira cookie", () => {
    const res = run("https://linkbio.dev.br/login/entrar?token=curto");
    expect(res.headers.get("location")).toBe("https://linkbio.dev.br/login/entrar");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("sem token segue para a página", () => {
    const res = run("https://linkbio.dev.br/login/entrar");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("a rota de falha não exige sessão", () => {
    const res = run("https://linkbio.dev.br/login/entrar/falha");
    expect(res.headers.get("location")).toBeNull();
  });

  it("o painel sem sessão continua indo para o login", () => {
    const res = run("https://linkbio.dev.br/dashboard/resultados?q=1");
    expect(res.headers.get("location")).toBe("https://linkbio.dev.br/login");
  });
});
