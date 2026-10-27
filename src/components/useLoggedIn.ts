"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const read = () => document.cookie.split("; ").includes("lb_logged=1");

/**
 * Se há sessão, pelo cookie lb_logged (o de sessão é httpOnly). A home é estática: no servidor e na
 * hidratação vale false, e o navegador corrige logo depois. É só aparência; o painel valida a sessão.
 */
export function useLoggedIn() {
  return useSyncExternalStore(subscribe, read, () => false);
}
