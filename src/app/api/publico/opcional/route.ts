// El cliente marca o desmarca un opcional en su página. El total se recalcula
// aquí con la función de siempre: el navegador solo lo pinta.
//
// DUEÑO: carril B2.
import { and, eq } from "drizzle-orm";
import { db, linea } from "@/db";
import { registrarEvento } from "@/lib/eventos";
import { recalcular } from "@/lib/presupuestos";
import { cerrado, cuerpo, estaAbierto, noEncontrado, presupuestoPublico } from "../comun";

export async function POST(req: Request) {
  const datos = await cuerpo(req);
  const p = await presupuestoPublico(datos.token);
  if (!p) return noEncontrado();
  if (!estaAbierto(p)) return cerrado();

  const lineaId = Number(datos.lineaId);
  const elegida = datos.elegida === true;
  if (!Number.isInteger(lineaId)) {
    return Response.json({ error: "Falta la línea." }, { status: 400 });
  }

  // La línea tiene que ser de ESTE presupuesto y ser opcional: nunca se toca
  // una línea del cuerpo del presupuesto desde la página del cliente.
  const fila = await db
    .select({ id: linea.id, descripcion: linea.descripcion, elegida: linea.elegida })
    .from(linea)
    .where(and(eq(linea.id, lineaId), eq(linea.presupuestoId, p.id), eq(linea.opcional, true)))
    .get();
  if (!fila) return noEncontrado();

  if (fila.elegida !== elegida) {
    await db.update(linea).set({ elegida }).where(eq(linea.id, fila.id)).run();
    await registrarEvento(p.id, "opcional_marcado", { descripcion: fila.descripcion, elegida });
  }

  const importes = await recalcular(p.id);
  return Response.json({
    base: importes.base,
    ivaImporte: importes.ivaImporte,
    total: importes.total,
  });
}
