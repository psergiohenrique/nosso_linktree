import type { FormField } from "./form-fields";

export type FormProgress = {
  id: string;
  fields: string;
  step: number;
  version?: number;
  conflict?: boolean;
  answers: Record<string, string | string[]>;
  other: Record<string, string | null>;
};

/** Não reutiliza um identificador sem as respostas correspondentes ou com perguntas alteradas. */
export function readProgress(raw: string | null, fields: FormField[]): FormProgress | null {
  try {
    const p = JSON.parse(raw ?? "null") as FormProgress | null;
    if (!p || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id)
      || p.fields !== JSON.stringify(fields) || !Number.isInteger(p.step) || p.step < 0 || p.step >= fields.length
      || (p.conflict !== undefined && typeof p.conflict !== "boolean")
      || (p.version !== undefined && (!Number.isSafeInteger(p.version) || p.version < 0))
      || !p.answers || typeof p.answers !== "object" || Array.isArray(p.answers)
      || !p.other || typeof p.other !== "object" || Array.isArray(p.other)) return null;
    if (Object.values(p.answers).some((v) => typeof v !== "string" && !(Array.isArray(v) && v.every((x) => typeof x === "string")))
      || Object.values(p.other).some((v) => v !== null && typeof v !== "string")) return null;
    return p;
  } catch {
    return null;
  }
}
