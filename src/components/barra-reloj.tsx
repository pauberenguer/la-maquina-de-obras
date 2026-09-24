"use client";
// El reloj de la demo. Solo aparece con DEMO_MODE=1. Mueve el desplazamiento
// que guarda la tabla negocio: no toca la hora del sistema.
import { useTransition } from "react";
import { FastForwardIcon, RotateCcwIcon } from "lucide-react";
import { adelantarReloj } from "@/app/panel/acciones";

export function BarraReloj({ desfase, fecha }: { desfase: number; fecha: string }) {
  const [pendiente, empezar] = useTransition();
  const dias = Math.round(desfase / 86_400_000);

  return (
    <div className="no-imprimir flex flex-wrap items-center gap-2 border-b bg-secondary/70 px-6 py-1.5 text-xs text-muted-foreground">
      <span className="font-medium">Reloj de la Demo</span>
      <span className="cifra">{fecha}</span>
      {dias !== 0 && (
        <span className="rounded-md bg-conversacion-fondo px-1.5 py-0.5 font-medium text-conversacion">
          {dias > 0 ? `+${dias}` : dias} {Math.abs(dias) === 1 ? "día" : "días"}
        </span>
      )}
      <span className="flex-1" />
      <button
        type="button"
        disabled={pendiente}
        onClick={() => empezar(() => void adelantarReloj(1))}
        className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 font-medium transition-colors hover:bg-secondary disabled:opacity-50"
      >
        <FastForwardIcon className="size-3" /> +1 día
      </button>
      <button
        type="button"
        disabled={pendiente}
        onClick={() => empezar(() => void adelantarReloj(3))}
        className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 font-medium transition-colors hover:bg-secondary disabled:opacity-50"
      >
        <FastForwardIcon className="size-3" /> +3 días
      </button>
      <button
        type="button"
        disabled={pendiente || dias === 0}
        onClick={() => empezar(() => void adelantarReloj(0))}
        className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 font-medium transition-colors hover:bg-secondary disabled:opacity-40"
      >
        <RotateCcwIcon className="size-3" /> Reiniciar Reloj
      </button>
    </div>
  );
}
