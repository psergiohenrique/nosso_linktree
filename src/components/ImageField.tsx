"use client";

import { useState } from "react";
import ImageInput from "./ImageInput";

/** Botão "Adicionar/Trocar imagem" (no lugar do campo de arquivo nativo) que mostra o nome do arquivo escolhido. */
export default function ImageField({ name, hasImage = false }: { name: string; hasImage?: boolean }) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <span className="image-field">
      <label className="btn btn-outline btn-sm file-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m21 16-5-5-8 8" />
        </svg>
        {hasImage || fileName ? "Trocar imagem" : "Adicionar imagem"}
        <ImageInput name={name} onFile={(file) => setFileName(file?.name ?? null)} />
      </label>
      {fileName && <span className="image-name">{fileName}</span>}
    </span>
  );
}
