"use client";

import { MAX_UPLOAD_BYTES, shrinkImage } from "@/lib/shrink-image";

type Props = {
  name: string;
  /** Recebe o arquivo já reduzido (ou null se a escolha foi desfeita). */
  onFile?: (file: File | null) => void;
};

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/**
 * Campo de imagem que reduz a foto no navegador antes do envio, para o formulário nunca passar do
 * limite das Server Actions. Se mesmo assim ficar grande, avisa e limpa o campo.
 */
export default function ImageInput({ name, onFile }: Props) {
  return (
    <input
      type="file"
      name={name}
      accept={ACCEPT}
      onChange={async (e) => {
        const input = e.currentTarget;
        const original = input.files?.[0];
        if (!original) return onFile?.(null);

        const file = await shrinkImage(original);
        if (file.size > MAX_UPLOAD_BYTES) {
          input.value = "";
          onFile?.(null);
          window.alert("Essa imagem passa de 2 MB. Escolha outra ou reduza o tamanho dela.");
          return;
        }
        if (file !== original) {
          const transfer = new DataTransfer();
          transfer.items.add(file);
          input.files = transfer.files;
        }
        onFile?.(file);
      }}
    />
  );
}
