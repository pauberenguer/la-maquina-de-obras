// La urgencia de una visita, con el mismo lenguaje visual que los estados:
// fondo suave y punto de color. No inventa colores: usa los tokens de la casa.
import { cn } from "cn";
import type { Urgencia } from "@/lib/tipos";

const ESTILO: Record<Urgencia, { etiqueta: string; punto: string; fondo: string; texto: string }> = {
  alta: {
    etiqueta: "Urgente",
    punto: "bg-conversacion",
    fondo: "bg-conversacion-fondo",
    texto: "text-conversacion",
  },
  media: {
    etiqueta: "Normal",
    punto: "bg-borrador",
    fondo: "bg-borrador-fondo",
    texto: "text-borrador",
  },
  baja: {
    etiqueta: "Sin Prisa",
    punto: "bg-borrador",
    fondo: "bg-borrador-fondo",
    texto: "text-borrador",
  },
};

export function UrgenciaBadge({ urgencia, className }: { urgencia: Urgencia; className?: string }) {
  const estilo = ESTILO[urgencia] ?? ESTILO.media;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap",
        estilo.fondo,
        estilo.texto,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", estilo.punto)} aria-hidden />
      {estilo.etiqueta}
    </span>
  );
}
