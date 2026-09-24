// «Tengo dudas»: el cliente escribe y la persecución se para en seco.
//
// DUEÑO: carril B2.
import { notificar } from "@/lib/avisos";
import { marcarRespuesta } from "@/lib/eventos";
import { formatoEurosCorto } from "@/lib/formato";
import { cerrado, cuerpo, estaAbierto, noEncontrado, presupuestoPublico } from "../comun";

const LARGO_MAXIMO = 2000;

export async function POST(req: Request) {
  const datos = await cuerpo(req);
  const p = await presupuestoPublico(datos.token);
  if (!p) return noEncontrado();
  if (!estaAbierto(p)) return cerrado();

  const texto = typeof datos.texto === "string" ? datos.texto.trim().slice(0, LARGO_MAXIMO) : "";
  if (texto.length === 0) {
    return Response.json({ error: "Escribe tu duda antes de enviarla." }, { status: 400 });
  }

  // Guarda la respuesta, cancela los seguimientos y pasa a En conversación.
  await marcarRespuesta(p.id, texto);

  const nombre = p.clienteNombre.split(" ")[0];
  await notificar(
    p.id,
    `💬 ${nombre} tiene dudas · ${formatoEurosCorto(p.total)} · ${p.titulo} · los seguimientos se han pausado · llámale`,
  );

  return Response.json({ ok: true });
}
