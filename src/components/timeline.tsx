// El timeline de Actividad: una fila por evento, con icono, frase humana y hora.
import { cn } from "cn";
import {
  BanknoteIcon,
  BellIcon,
  CircleDotIcon,
  EyeIcon,
  FileTextIcon,
  MessageSquareTextIcon,
  PenLineIcon,
  SendIcon,
  SquarePenIcon,
  XCircleIcon,
} from "lucide-react";
import { formatoFechaHora } from "@/lib/formato";
import { fraseDeEvento, type IconoFrase } from "@/lib/frases";

const ICONOS: Record<IconoFrase, typeof EyeIcon> = {
  creado: SquarePenIcon,
  enviado: SendIcon,
  abierto: EyeIcon,
  respuesta: MessageSquareTextIcon,
  seguimiento: BanknoteIcon,
  cancelado: XCircleIcon,
  estado: CircleDotIcon,
  firmado: PenLineIcon,
  aviso: BellIcon,
  pdf: FileTextIcon,
};

const TONO = {
  normal: "bg-secondary text-muted-foreground",
  bueno: "bg-ganado-fondo text-ganado",
  malo: "bg-perdido-fondo text-perdido",
  aviso: "bg-conversacion-fondo text-conversacion",
};

export type EntradaTimeline = {
  id: number;
  tipo: string;
  meta: string;
  ts: Date;
};

export function Timeline({ entradas, className }: { entradas: EntradaTimeline[]; className?: string }) {
  if (entradas.length === 0) {
    return (
      <p className={cn("px-1 py-6 text-sm text-muted-foreground", className)}>
        Todavía no ha pasado nada con este presupuesto. En cuanto lo envíes, aquí aparecerá cada
        apertura, cada seguimiento y cada respuesta.
      </p>
    );
  }
  return (
    <ol className={cn("relative space-y-0", className)}>
      {entradas.map((entrada, i) => {
        const frase = fraseDeEvento(entrada.tipo, entrada.meta);
        const Icono = ICONOS[frase.icono] ?? CircleDotIcon;
        const ultimo = i === entradas.length - 1;
        return (
          <li key={entrada.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!ultimo && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border" aria-hidden />}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                TONO[frase.tono ?? "normal"],
              )}
            >
              <Icono className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm leading-snug font-medium">{frase.texto}</p>
              {frase.detalle && (
                <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{frase.detalle}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{formatoFechaHora(entrada.ts)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
