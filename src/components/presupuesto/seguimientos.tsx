// La pestaña Seguimientos: la próxima acción programada y los tres toques de la
// persecución, con su texto. Lo que aún no ha salido se puede reescribir y
// cancelar; lo que ya salió es historia y no se toca.
//
// DUEÑO: carril C.
import { cn } from "cn";
import { CircleCheckIcon, CircleSlashIcon, ClockIcon } from "lucide-react";
import { AccionesDelSeguimiento } from "@/components/presupuesto/seguimientos-editor";
import { eventosDe, presupuestoPorId, tareasDe, type PresupuestoConCliente } from "@/lib/consultas";
import { formatoFechaHora, formatoRelativo } from "@/lib/formato";
import { ahora, cargarReloj } from "@/lib/reloj";
import type { Estado, TipoTarea } from "@/lib/tipos";

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

/**
 * Por qué se pararon los seguimientos: primero lo que quedó escrito en el
 * timeline y, si no hay nada escrito, lo que dice el propio estado. Nunca se
 * queda en un «está parada» sin explicación.
 */
async function porQueSeCancelaron(presupuesto: PresupuestoConCliente): Promise<string> {
  for (const e of await eventosDe(presupuesto.id)) {
    if (e.tipo !== "seguimiento_cancelado") continue;
    try {
      const meta = JSON.parse(e.meta) as { porque?: unknown };
      if (typeof meta.porque === "string" && meta.porque) return meta.porque;
    } catch {
      // Un meta ilegible no puede tumbar la pestaña.
    }
  }

  switch (presupuesto.estado as Estado) {
    case "ganado":
      return "el cliente aceptó y firmó";
    case "perdido":
      return presupuesto.motivoPerdido
        ? `el presupuesto se marcó como perdido · ${presupuesto.motivoPerdido.toLowerCase()}`
        : "el presupuesto se marcó como perdido";
    case "expirado":
      return "el presupuesto caducó";
    case "en_conversacion":
      return "el cliente respondió";
    default:
      return "la persecución está parada";
  }
}

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
  const enviadas = tareas.filter((t) => t.estado === "enviada").length;
  const presupuesto = await presupuestoPorId(presupuestoId);
  const motivo =
    presupuesto && tareas.some((t) => t.estado === "cancelada")
      ? await porQueSeCancelaron(presupuesto)
      : null;

  return (
    <div className="space-y-4">
      {proxima ? (
        <div className="rounded-lg border border-enviado/30 bg-enviado-fondo/60 px-3 py-2.5">
          <p className="text-xs font-medium tracking-wide text-enviado uppercase">
            Próxima Acción Programada
          </p>
          <p className="mt-1 text-sm font-medium">{NOMBRE[proxima.tipo as TipoTarea]}</p>
          <p className="text-xs text-muted-foreground">
            {formatoFechaHora(proxima.ejecutarEn)} · {formatoRelativo(proxima.ejecutarEn, hoy)}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-secondary/60 px-3 py-2.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            No Queda Ninguna Acción Programada
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {enviadas >= 3
              ? "Los tres toques ya han salido: la persecución ha terminado."
              : motivo
                ? `Persecución parada: ${motivo}.`
                : "La persecución está parada."}
          </p>
        </div>
      )}

      <ol className="space-y-3">
        {tareas.map((tarea) => {
          const estado = ESTADO[tarea.estado as keyof typeof ESTADO] ?? ESTADO.pendiente;
          const Icono = estado.icono;
          const pendiente = tarea.estado === "pendiente";
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
                    {pendiente && <> · {formatoRelativo(tarea.ejecutarEn, hoy)}</>}
                  </p>
                  {tarea.estado === "cancelada" && motivo && (
                    <p className="text-xs text-muted-foreground">No saldrá: {motivo}.</p>
                  )}
                </div>
              </div>

              {pendiente ? (
                <AccionesDelSeguimiento tareaId={tarea.id} texto={tarea.texto} />
              ) : (
                <p
                  className={cn(
                    "mt-2 border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground",
                    tarea.estado === "cancelada" && "line-through opacity-60",
                  )}
                >
                  {tarea.texto}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
