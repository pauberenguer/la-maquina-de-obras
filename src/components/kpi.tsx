// Un número de LOS NÚMEROS: cifra grande, etiqueta arriba y su fórmula debajo.
// Cada € del panel enseña de dónde sale.
import { cn } from "cn";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
import type { Metrica } from "@/lib/metricas";

export function Kpi({ metrica, className }: { metrica: Metrica; className?: string }) {
  const { etiqueta, valor, formula, antes, mejora } = metrica;
  return (
    <div className={cn("flex flex-col gap-1 px-5 py-4", className)}>
      <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{etiqueta}</div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="cifra text-[30px] leading-9 font-semibold">{valor}</span>
        {antes && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
              mejora === "sube" ? "bg-ganado-fondo text-ganado" : "bg-perdido-fondo text-perdido",
            )}
          >
            {mejora === "sube" ? (
              <ArrowUpRightIcon className="size-3" />
            ) : (
              <ArrowDownRightIcon className="size-3" />
            )}
            {antes.etiqueta} {antes.valor}
          </span>
        )}
      </div>
      <p className="text-xs leading-snug text-muted-foreground">{formula}</p>
    </div>
  );
}
