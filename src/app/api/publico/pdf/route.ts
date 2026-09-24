// El cliente se ha descargado el PDF. No genera nada: el PDF lo hace el propio
// navegador con la hoja de impresión. Esto solo deja la huella en el timeline.
//
// DUEÑO: carril B2.
import { registrarEvento } from "@/lib/eventos";
import { cuerpo, noEncontrado, presupuestoPublico } from "../comun";

export async function POST(req: Request) {
  const datos = await cuerpo(req);
  const p = await presupuestoPublico(datos.token);
  if (!p) return noEncontrado();

  await registrarEvento(p.id, "pdf_descargado", {});
  return Response.json({ ok: true });
}
