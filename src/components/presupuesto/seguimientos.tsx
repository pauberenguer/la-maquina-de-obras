// La pestaña Seguimientos: la próxima acción programada y los tres toques de la
// persecución, con su texto.
//
// DUEÑO: carril C (la fase 6 hace el texto editable y ejecuta las tareas).
import { cn } from "cn";
import { CircleCheckIcon, CircleSlashIcon, ClockIcon } from "lucide-react";
import { tareasDe } from "@/lib/consultas";
import { formatoFechaHora, formatoRelativo } from "@/lib/formato";
import { ahora, cargarReloj } from "@/lib/reloj";
import type { TipoTarea } from "@/lib/tipos";

const NOMBRE: Record<TipoTarea, string> = {
  seguimiento_1: "Seguimiento 1 · a los 3 Días",
  seguimiento_2: "Seguimiento 2 · a los 7 Días",
  cierre: "Seguimiento 3 · a los 14 Días, con la Caducidad",
};

const ESTADO = {
  pendiente: { icono: ClockIcon, clase: "bg-enviado-fondo text-enviado", etiqueta: "Programado" },
  enviada: { icono: CircleCheckIcon, clase: "bg-ganado-fondo text-ganado", etiqueta: "Enviado" },
  cancelada: { icono: CircleSlashIcon, clase: "bg-secondary text-muted-foreground", etiqueta: "Cancelado" },
};

export async function Seguimientos({ presupuestoId }: { presupuestoId: number }) {
  await cargarReloj();
  const tareas = await tareasDe(presupuestoId);
  const hoy = ahora();

  if (tareas.length === 0) {
    return (
      <p className="px-1 py-6 text-sm text-muted-foreground">
        Los tres seguimientos se programan al enviar el presupuesto: a los 3, 7 y 14 días. Aquí
        podrás ver y editar el texto de cada uno antes de que salga.
      </p>
    );
  }

  const proxima = tareas.find((t) => t.estado === "pendiente");

  return (
    <div className="space-y-4">
      {proxima && (
        <div className="rounded-lg border border-enviado/30 bg-enviado-fondo/60 px-3 py-2.5">
          <p className="text-xs font-medium tracking-wide text-enviado uppercase">
            Próxima Acción Programada
          </p>
          <p className="mt-1 text-sm font-medium">{NOMBRE[proxima.tipo as TipoTarea]}</p>
          <p className="text-xs text-muted-foreground">
            {formatoFechaHora(proxima.ejecutarEn)} · {formatoRelativo(proxima.ejecutarEn, hoy)}
          </p>
        </div>
      )}

      <ol className="space-y-3">
        {tareas.map((tarea) => {
          const estado = ESTADO[tarea.estado as keyof typeof ESTADO] ?? ESTADO.pendiente;
          const Icono = estado.icono;
          return (
            <li key={tarea.id} className="rounded-lg border bg-card px-3 py-2.5">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
                    estado.clase,
                  )}
                >
                  <Icono className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{NOMBRE[tarea.tipo as TipoTarea] ?? tarea.tipo}</p>
                  <p className="text-xs text-muted-foreground">
                    {estado.etiqueta} · {formatoFechaHora(tarea.ejecutadaEn ?? tarea.ejecutarEn)}
                  </p>
                </div>
              </div>
              <p className="mt-2 border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground">
                {tarea.texto}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
