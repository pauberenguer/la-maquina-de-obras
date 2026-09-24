// Una pantalla vacía que sirve de algo: dice qué va a aparecer aquí y qué hacer
// para que aparezca. Nunca «próximamente».
import { cn } from "cn";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icono: Icono,
  titulo,
  texto,
  accion,
  className,
}: {
  icono: LucideIcon;
  titulo: string;
  texto: string;
  accion?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card px-6 py-14 text-center",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <Icono className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="font-medium">{titulo}</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{texto}</p>
      </div>
      {accion}
    </div>
  );
}
