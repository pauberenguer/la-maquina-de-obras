// La pestaña Actividad de la ficha: el timeline completo en frases humanas.
//
// DUEÑO: carril C (la fase 5 le añade el detalle fino del tracking).
import { Timeline } from "@/components/timeline";
import { eventosDe } from "@/lib/consultas";

export async function Actividad({ presupuestoId }: { presupuestoId: number }) {
  const eventos = await eventosDe(presupuestoId);
  return (
    <Timeline
      entradas={eventos.map((e) => ({ id: e.id, tipo: e.tipo, meta: e.meta, ts: e.ts }))}
    />
  );
}
