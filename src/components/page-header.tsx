// La cabecera de una página del panel: título, subtítulo en gris y acciones a
// la derecha (secundaria con borde, primaria en azul).
import { cn } from "cn";

export function PageHeader({
  titulo,
  subtitulo,
  acciones,
  className,
}: {
  titulo: string;
  subtitulo?: React.ReactNode;
  acciones?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] leading-7 font-semibold tracking-tight">{titulo}</h1>
        {subtitulo && <div className="mt-1 text-sm text-muted-foreground">{subtitulo}</div>}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}
