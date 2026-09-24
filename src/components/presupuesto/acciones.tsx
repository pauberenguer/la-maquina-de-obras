// Las acciones de la ficha: abrir el editor si es Borrador, enviar al cliente,
// reenviar, marcar Ganado a mano y marcar Perdido con motivo.
//
// DUEÑO: carril B (fases 3 y 4). Mientras no haya editor ni envío, la ficha no
// enseña botones que no hagan nada.
import type { PresupuestoConCliente } from "@/lib/consultas";

export function AccionesDelPresupuesto({ presupuesto }: { presupuesto: PresupuestoConCliente }) {
  void presupuesto;
  return null;
}
