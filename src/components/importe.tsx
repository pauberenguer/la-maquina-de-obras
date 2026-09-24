// Un importe en euros, siempre en formato es-ES y con cifras tabulares para que
// las columnas cuadren por la coma.
import { cn } from "cn";
import { formatoEuros, formatoEurosCorto } from "@/lib/formato";

export function Importe({
  centimos,
  corto = false,
  className,
  tono,
}: {
  centimos: number;
  /** «14.300 €» en vez de «14.300,50 €». Para titulares y tarjetas. */
  corto?: boolean;
  className?: string;
  tono?: "normal" | "positivo" | "apagado";
}) {
  return (
    <span
      className={cn(
        "cifra whitespace-nowrap",
        tono === "positivo" && "text-positivo",
        tono === "apagado" && "text-muted-foreground",
        className,
      )}
    >
      {corto ? formatoEurosCorto(centimos) : formatoEuros(centimos)}
    </span>
  );
}
