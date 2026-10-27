"use client";

import Link from "next/link";
import { useLoggedIn } from "./useLoggedIn";

export default function FooterAccountLink() {
  return useLoggedIn() ? <Link href="/dashboard">Meu painel</Link> : <Link href="/login">Entrar</Link>;
}
