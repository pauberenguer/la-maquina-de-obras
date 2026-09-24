// El timeline y la máquina de estados. Todo lo que le pasa a un presupuesto
// entra por aquí: así los tres carriles escriben la misma historia y nadie se
// inventa una transición.
//
// Con la base asíncrona, leer y luego escribir deja un hueco en el que otra
// petición puede colarse. Por eso las escrituras que deciden algo van
// condicionadas en el propio UPDATE: solo cambia quien llega primero.
//
// DUEÑO: sesión principal. Los carriles lo IMPORTAN, no lo editan.
import { and, eq, sql } from "drizzle-orm";
import { db, evento, presupuesto, pulso, tareaProgramada } from "@/db";
import { ahora, cargarReloj } from "./reloj";
import { ESTADOS_CERRADOS, type Estado, type TipoEvento } from "./tipos";

/** Sube el contador que mira el polling cada 3 s. Barato y sin efectos. */
export async function tocarPulso(): Promise<void> {
  await cargarReloj();
  await db
    .insert(pulso)
    .values({ id: 1, version: 1, actualizadoEn: ahora() })
    .onConflictDoUpdate({
      target: pulso.id,
      set: { version: sql`${pulso.version} + 1`, actualizadoEn: ahora() },
    })
    .run();
}

/**
 * Escribe una entrada del timeline. `meta` es lo que necesite su frase en
 * frases.ts: nadie guarda aquí texto ya formateado.
 */
export async function registrarEvento(
  presupuestoId: number | null,
  tipo: TipoEvento,
  meta: Record<string, unknown> = {},
  ts?: Date,
): Promise<number> {
  await cargarReloj();
  const fila = await db
    .insert(evento)
    .values({ presupuestoId, tipo, meta: JSON.stringify(meta), ts: ts ?? ahora() })
    .returning({ id: evento.id })
    .get();
  await tocarPulso();
  return fila.id;
}

/** Cancela las tareas pendientes de un presupuesto. Devuelve cuántas ha parado. */
export async function cancelarTareas(presupuestoId: number, porque: string): Promise<number> {
  // El UPDATE devuelve las que ha cambiado él: si dos peticiones cancelan a la
  // vez, solo una cuenta las tareas y deja el evento.
  const canceladas = await db
    .update(tareaProgramada)
    .set({ estado: "cancelada" })
    .where(
      and(
        eq(tareaProgramada.presupuestoId, presupuestoId),
        eq(tareaProgramada.estado, "pendiente"),
      ),
    )
    .returning({ id: tareaProgramada.id })
    .all();
  if (canceladas.length === 0) return 0;

  await registrarEvento(presupuestoId, "seguimiento_cancelado", { porque, cuantas: canceladas.length });
  return canceladas.length;
}

const ESTADO_CERRADO = new Set<string>(ESTADOS_CERRADOS);

/**
 * La ÚNICA puerta de estado del producto: escribe el estado, la fecha de
 * cierre y el motivo, cancela la persecución si el presupuesto se cierra y deja
 * la entrada en el timeline.
 *
 * Es idempotente y segura a la vez: si ya estaba en ese estado, o si otra
 * petición lo ha cambiado entre la lectura y la escritura, no hace nada y
 * devuelve false.
 */
export async function cambiarEstado(
  presupuestoId: number,
  nuevo: Estado,
  porque?: string,
  extra: { motivoPerdido?: string } = {},
): Promise<boolean> {
  await cargarReloj();
  const actual = await db
    .select({ estado: presupuesto.estado, cerradoEn: presupuesto.cerradoEn })
    .from(presupuesto)
    .where(eq(presupuesto.id, presupuestoId))
    .get();
  if (!actual) throw new Error(`No existe el presupuesto ${presupuestoId}`);
  if (actual.estado === nuevo) return false;

  const ts = ahora();
  const cierra = ESTADO_CERRADO.has(nuevo);
  const cambio = await db
    .update(presupuesto)
    .set({
      estado: nuevo,
      ...(cierra ? { cerradoEn: actual.cerradoEn ?? ts } : {}),
      ...(extra.motivoPerdido !== undefined ? { motivoPerdido: extra.motivoPerdido } : {}),
    })
    // Solo si sigue en el estado que hemos leído: el que llega segundo no toca nada.
    .where(and(eq(presupuesto.id, presupuestoId), eq(presupuesto.estado, actual.estado)))
    .run();
  if (cambio.rowsAffected !== 1) return false;

  await registrarEvento(presupuestoId, "cambio_estado", {
    de: actual.estado,
    a: nuevo,
    ...(porque ? { porque } : {}),
  }, ts);

  if (cierra) {
    await cancelarTareas(
      presupuestoId,
      nuevo === "ganado"
        ? "el cliente ha aceptado"
        : nuevo === "perdido"
          ? "el presupuesto se ha marcado como perdido"
          : "el presupuesto ha caducado",
    );
  }
  return true;
}

/**
 * «Tengo dudas»: guarda la respuesta, para la persecución y deja el
 * presupuesto En conversación. No avisa: de eso se encarga quien llama
 * (la página pública), para que el aviso lleve el importe y el nombre.
 */
export async function marcarRespuesta(presupuestoId: number, texto: string): Promise<void> {
  await cargarReloj();
  const ts = ahora();
  await db
    .update(presupuesto)
    .set({ respondioEn: ts, respuestaTexto: texto })
    .where(eq(presupuesto.id, presupuestoId))
    .run();
  await registrarEvento(presupuestoId, "respuesta_cliente", { texto }, ts);
  // Una respuesta para la persecución aunque el presupuesto ya estuviera En
  // conversación: el máximo de tres toques es por construcción.
  await cancelarTareas(presupuestoId, "el cliente ha respondido");
  await cambiarEstado(presupuestoId, "en_conversacion", "el cliente ha escrito");
}

/** El estado de un presupuesto, sin traerse la fila entera. */
export async function estadoDe(presupuestoId: number): Promise<Estado | null> {
  const fila = await db
    .select({ estado: presupuesto.estado })
    .from(presupuesto)
    .where(eq(presupuesto.id, presupuestoId))
    .get();
  return (fila?.estado as Estado | undefined) ?? null;
}
