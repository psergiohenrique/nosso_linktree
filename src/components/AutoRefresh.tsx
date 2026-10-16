"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Volta do checkout: o pagamento só vale quando o webhook do Asaas confirma (segundos depois).
 * Enquanto isso, recarrega os dados da página a cada 3 s, no máximo 20 vezes.
 */
export default function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= 20) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
