"use client";
// Un desplegable sobrio con el mismo borde, alto y radio que el resto de
// campos. Nativo a propósito: en el móvil abre el selector del sistema.
import { cn } from "cn";

export function Selector({
  valor,
  onCambiar,
  opciones,
  className,
  id,
  deshabilitado = false,
  "aria-label": etiqueta,
}: {
  valor: string;
  onCambiar: (valor: string) => void;
  opciones: { valor: string; etiqueta: string }[];
  className?: string;
  id?: string;
  deshabilitado?: boolean;
  "aria-label"?: string;
}) {
  return (
    <select
      id={id}
      aria-label={etiqueta}
      value={valor}
      disabled={deshabilitado}
      onChange={(e) => onCambiar(e.target.value)}
      className={cn(
        "h-8 rounded-lg border border-input bg-transparent px-2 text-sm transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.etiqueta}
        </option>
      ))}
    </select>
  );
}
