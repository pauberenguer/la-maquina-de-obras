// El estado de un presupuesto, con el mismo color en todo el producto.
// Fondo suave y punto de color, como los badges de Holded.
import { cn } from "cn";
import type { Estado } from "@/lib/tipos";

const ESTILO: Record<Estado, { etiqueta: string; punto: string; fondo: string; texto: string }> = {
  borrador: { etiqueta: "Borrador", punto: "bg-borrador", fondo: "bg-borrador-fondo", texto: "text-borrador" },
  enviado: { etiqueta: "Enviado", punto: "bg-enviado", fondo: "bg-enviado-fondo", texto: "text-enviado" },
  visto: { etiqueta: "Visto", punto: "bg-visto", fondo: "bg-visto-fondo", texto: "text-visto" },
  en_conversacion: {
    etiqueta: "En Conversación",
    punto: "bg-conversacion",
    fondo: "bg-conversacion-fondo",
    texto: "text-conversacion",
  },
  ganado: { etiqueta: "Ganado", punto: "bg-ganado", fondo: "bg-ganado-fondo", texto: "text-ganado" },
  perdido: { etiqueta: "Perdido", punto: "bg-perdido", fondo: "bg-perdido-fondo", texto: "text-perdido" },
  expirado: { etiqueta: "Expirado", punto: "bg-expirado", fondo: "bg-expirado-fondo", texto: "text-expirado" },
};

export function etiquetaDeEstado(estado: Estado): string {
  return ESTILO[estado]?.etiqueta ?? estado;
}

export function EstadoBadge({
  estado,
  className,
  tamano = "normal",
}: {
  estado: Estado;
  className?: string;
  tamano?: "normal" | "pequeno";
}) {
  const estilo = ESTILO[estado] ?? ESTILO.borrador;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md font-medium whitespace-nowrap",
        tamano === "pequeno" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
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
