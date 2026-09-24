"use client";
// Una celda del banco que se edita pinchándola: se escribe encima y se guarda
// con Intro o al salir. Sin abrir un formulario aparte.
import { useRef, useState, useTransition } from "react";
import { cn } from "cn";
import { toast } from "sonner";

export function CeldaEditable({
  texto,
  valorInicial,
  guardar,
  etiqueta,
  className,
}: {
  /** Lo que se ve cuando la celda está en reposo. */
  texto: string;
  /** Lo que aparece dentro del campo al empezar a editar. */
  valorInicial: string;
  guardar: (valor: string) => Promise<{ ok: boolean; mensaje: string }>;
  /** Para los lectores de pantalla: «Precio de ALB-01». */
  etiqueta: string;
  className?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [pendiente, empezar] = useTransition();
  const cancelado = useRef(false);

  function confirmar(valor: string) {
    if (cancelado.current) return;
    setEditando(false);
    if (valor.trim() === valorInicial.trim()) return;
    empezar(async () => {
      const resultado = await guardar(valor);
      if (resultado.ok) toast.success(resultado.mensaje);
      else toast.error(resultado.mensaje);
    });
  }

  if (editando) {
    return (
      <input
        autoFocus
        defaultValue={valorInicial}
        aria-label={etiqueta}
        inputMode="decimal"
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => confirmar(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmar(e.currentTarget.value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancelado.current = true;
            setEditando(false);
            setTimeout(() => (cancelado.current = false), 0);
          }
        }}
        className={cn(
          "cifra h-7 w-full rounded-md border border-ring bg-card px-1.5 text-right text-sm outline-none ring-3 ring-ring/50",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={etiqueta}
      disabled={pendiente}
      onClick={() => setEditando(true)}
      className={cn(
        "cifra h-7 w-full rounded-md border border-transparent px-1.5 text-right text-sm transition-colors hover:border-input hover:bg-card focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        pendiente && "opacity-50",
        className,
      )}
    >
      {texto}
    </button>
  );
}
