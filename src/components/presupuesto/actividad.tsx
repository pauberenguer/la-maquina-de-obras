// La pestaña Actividad de la ficha: todo lo que le ha pasado a este
// presupuesto, en frases humanas y en orden, del último al primero.
//
// El timeline junta dos fuentes: los eventos (creado, enviado, cada apertura
// con su tiempo por sección, cada seguimiento con su texto, cada respuesta,
// cada cambio de estado con su porqué) y los avisos que han salido al móvil del
// jefe. Manolo lee aquí la historia completa de una obra.
//
// DUEÑO: carril C.
import { Timeline, type EntradaTimeline } from "@/components/timeline";
import { avisosDe } from "@/lib/avisos";
import { eventosDe } from "@/lib/consultas";

/**
 * Un aviso que sale a la vez que su evento cuenta lo mismo dos veces («ha
 * abierto el presupuesto» / «👀 ha abierto tu presupuesto»). Se queda el
 * evento, que trae más detalle, y el aviso solo aparece cuando dice algo que
 * no está ya arriba: el recuento agrupado de aperturas, por ejemplo.
 */
const MARGEN_MS = 4000;

export async function Actividad({ presupuestoId }: { presupuestoId: number }) {
  const [eventos, avisos] = await Promise.all([eventosDe(presupuestoId), avisosDe(presupuestoId)]);
  const instantes = eventos.map((e) => e.ts.getTime());

  const entradas: EntradaTimeline[] = [
    ...eventos.map((e) => ({ id: e.id, tipo: e.tipo, meta: e.meta, ts: e.ts })),
    ...avisos
      .filter((a) => !instantes.some((t) => Math.abs(t - a.ts.getTime()) <= MARGEN_MS))
      // Los ids de aviso y de evento se pisarían: los avisos van en negativo.
      .map((a) => ({
        id: -a.id,
        tipo: "aviso_enviado",
        meta: JSON.stringify({ texto: a.texto }),
        ts: a.ts,
      })),
  ].sort((a, b) => b.ts.getTime() - a.ts.getTime());

  return <Timeline entradas={entradas} />;
}
