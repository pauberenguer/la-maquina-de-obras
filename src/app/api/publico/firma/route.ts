// La firma del cliente: el momento en que un presupuesto se convierte en obra.
//
// Se guarda la imagen, la fecha y hora, la IP y el dispositivo; el presupuesto
// pasa a Ganado (lo que cancela la persecución) y el móvil del jefe se entera.
//
// DUEÑO: carril B2.
import { and, eq, isNull } from "drizzle-orm";
import { db, presupuesto } from "@/db";
import { notificar } from "@/lib/avisos";
import { presupuestoPorId } from "@/lib/consultas";
import { cambiarEstado, registrarEvento } from "@/lib/eventos";
import { formatoEurosCorto } from "@/lib/formato";
import { recalcular } from "@/lib/presupuestos";
import { ahora } from "@/lib/reloj";
import {
  cerrado,
  cuerpo,
  datosDeLaPeticion,
  estaAbierto,
  noEncontrado,
  presupuestoPublico,
} from "../comun";

/** Un PNG de firma razonable no pasa de esto ni de lejos. */
const LARGO_MAXIMO = 2_000_000;

export async function POST(req: Request) {
  const datos = await cuerpo(req);
  const p = await presupuestoPublico(datos.token);
  if (!p) return noEncontrado();
  if (!estaAbierto(p)) return cerrado();

  const png = typeof datos.firma === "string" ? datos.firma : "";
  if (!png.startsWith("data:image/png;base64,") || png.length > LARGO_MAXIMO) {
    return Response.json({ error: "La firma no ha llegado bien. Vuelve a intentarlo." }, { status: 400 });
  }

  const { ip, dispositivo } = await datosDeLaPeticion();
  const ts = ahora();

  // El total que se firma es el de este momento, con los opcionales marcados.
  await recalcular(p.id);

  // Solo se firma una vez: si llegan dos confirmaciones seguidas, la segunda
  // no deja otro evento ni manda otro aviso.
  const guardada = await db
    .update(presupuesto)
    .set({ firmaPng: png, firmadoEn: ts, firmaIp: ip, firmaDispositivo: dispositivo })
    .where(and(eq(presupuesto.id, p.id), isNull(presupuesto.firmaPng)))
    .run();
  if (guardada.rowsAffected !== 1) return Response.json({ ok: true });

  await cambiarEstado(p.id, "ganado", "el cliente ha firmado");

  const firmado = (await presupuestoPorId(p.id))!;
  await registrarEvento(p.id, "firmado", { total: firmado.total, ip, dispositivo }, ts);

  const nombre = firmado.clienteNombre.split(" ")[0];
  await notificar(
    p.id,
    `✅ ${nombre} ha aceptado y firmado el presupuesto de ${formatoEurosCorto(firmado.total)} · ${firmado.titulo} · obra ganada`,
  );

  return Response.json({ ok: true });
}
