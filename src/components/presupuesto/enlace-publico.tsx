"use client";
// El enlace público del presupuesto, con botón de copiar.
import { useState } from "react";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";

export function EnlacePublico({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("El navegador no ha dejado copiar. Selecciona el enlace y cópialo a mano.");
    }
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border bg-secondary/60 px-2 py-1.5">
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{url}</span>
      <button
        type="button"
        onClick={copiar}
        aria-label="Copiar Enlace"
        className="flex size-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-card"
      >
        {copiado ? <CheckIcon className="size-3.5 text-positivo" /> : <CopyIcon className="size-3.5" />}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label="Abrir la Página del Cliente"
        className="flex size-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-card"
      >
        <ExternalLinkIcon className="size-3.5" />
      </a>
    </div>
  );
}
