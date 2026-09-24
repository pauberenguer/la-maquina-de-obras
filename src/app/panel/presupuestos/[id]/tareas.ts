"use server";
// Los seguimientos de la ficha: cambiar el texto de un toque antes de que salga
// y cancelarlo a mano. Solo se puede tocar lo que todavía está pendiente: lo
// que ya salió es historia y no se reescribe. Como toda acción del panel, cada
// una empieza comprobando la sesión.
//
// DUEÑO: carril C.
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, tareaProgramada } from "@/db";
import { registrarEvento } from "@/lib/eventos";
import { ahora, cargarReloj } from "@/lib/reloj";
import { exigirSesion } from "@/lib/sesion";

export type ResultadoTarea = { ok: boolean; mensaje: string };

function refrescar(presupuestoId: number) {
  revalidatePath(`/panel/presupuestos/${presupuestoId}`);
  revalidatePath("/", "layout");
}

/** Guarda el texto de un seguimiento que todavía no ha salido. */
export async function guardarTextoDeSeguimiento(
  tareaId: number,
  texto: string,
): Promise<ResultadoTarea> {
  await exigirSesion();
  const limpio = texto.trim();
  if (!limpio) {
    return { ok: false, mensaje: "El seguimiento no puede quedarse sin texto." };
  }
  if (limpio.length > 1500) {
    return { ok: false, mensaje: "El seguimiento se ha ido de largo: déjalo en un par de párrafos." };
  }

  const tarea = await db.select().from(tareaProgramada).where(eq(tareaProgramada.id, tareaId)).get();
  if (!tarea) return { ok: false, mensaje: "Ese seguimiento ya no existe." };
  if (tarea.estado !== "pendiente") {
    return {
      ok: false,
      mensaje:
        tarea.estado === "enviada"
          ? "Ese seguimiento ya ha salido: su texto no se puede cambiar."
          : "Ese seguimiento está cancelado.",
    };
  }
  if (limpio === tarea.texto) return { ok: true, mensaje: "No había nada que cambiar." };

  await db
    .update(tareaProgramada)
    .set({ texto: limpio })
    .where(and(eq(tareaProgramada.id, tareaId), eq(tareaProgramada.estado, "pendiente")))
    .run();

  refrescar(tarea.presupuestoId);
  return { ok: true, mensaje: "Texto del seguimiento guardado." };
}

/** Cancela un solo toque. Los otros dos siguen su calendario. */
export async function cancelarSeguimiento(tareaId: number): Promise<ResultadoTarea> {
  await exigirSesion();
  await cargarReloj();
  const tarea = await db.select().from(tareaProgramada).where(eq(tareaProgramada.id, tareaId)).get();
  if (!tarea) return { ok: false, mensaje: "Ese seguimiento ya no existe." };
  if (tarea.estado !== "pendiente") {
    return { ok: false, mensaje: "Ese seguimiento ya no está programado." };
  }

  const cancelada = await db
    .update(tareaProgramada)
    .set({ estado: "cancelada" })
    .where(and(eq(tareaProgramada.id, tareaId), eq(tareaProgramada.estado, "pendiente")))
    .run();
  if (cancelada.rowsAffected !== 1) {
    return { ok: false, mensaje: "Ese seguimiento acaba de salir: ya no se puede cancelar." };
  }

  await registrarEvento(
    tarea.presupuestoId,
    "seguimiento_cancelado",
    { porque: "lo has cancelado a mano", cuantas: 1, tipo: tarea.tipo },
    ahora(),
  );

  refrescar(tarea.presupuestoId);
  return { ok: true, mensaje: "Seguimiento cancelado: no saldrá." };
}
