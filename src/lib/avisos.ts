// Los avisos: la campana del panel y, si hay claves, el móvil del jefe.
// Agrupados por presupuesto: como mucho uno por minuto.
//
// DUEÑO: carril C. La agrupación con recuento de aperturas y ciudades llega en
// la fase 5; aquí está lo mínimo para que la campana funcione desde el día uno.
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { aviso, db, presupuesto } from "@/db";
import { ahora, cargarReloj, UN_MINUTO } from "./reloj";
import { enviarTelegram, urlDeLaApp } from "./telegram";

/** Cuántos avisos sin leer tiene la campana. */
export async function avisosSinLeer(): Promise<number> {
  const fila = await db.select({ n: sql<number>`count(*)` }).from(aviso).where(eq(aviso.leido, false)).get();
  return Number(fila?.n ?? 0);
}

/** Los últimos avisos, los no leídos primero por fecha. */
export async function ultimosAvisos(limite = 20) {
  return db.select().from(aviso).orderBy(desc(aviso.ts)).limit(limite).all();
}

export async function marcarAvisosLeidos(): Promise<void> {
  await db.update(aviso).set({ leido: true }).where(eq(aviso.leido, false)).run();
}

/** ¿Se puede avisar ya de este presupuesto, o sigue dentro del minuto de gracia? */
export async function puedeAvisar(presupuestoId: number): Promise<boolean> {
  await cargarReloj();
  const fila = await db
    .select({ ts: presupuesto.ultimoAvisoEn })
    .from(presupuesto)
    .where(eq(presupuesto.id, presupuestoId))
    .get();
  const ultimo = fila?.ts;
  return !ultimo || ahora().getTime() - ultimo.getTime() >= UN_MINUTO;
}

/** El enlace del panel que acompaña a cada aviso. */
export function enlaceDelPanel(presupuestoId: number | null): string {
  return presupuestoId ? `${urlDeLaApp()}/panel/presupuestos/${presupuestoId}` : `${urlDeLaApp()}/panel`;
}

/**
 * Deja el aviso en la campana y lo manda al móvil del jefe.
 * Respeta la agrupación: un aviso por minuto y presupuesto.
 */
export async function notificar(
  presupuestoId: number | null,
  texto: string,
  enlace = enlaceDelPanel(presupuestoId),
): Promise<void> {
  await cargarReloj();
  const ts = ahora();
  await db.insert(aviso).values({ presupuestoId, texto, leido: false, ts }).run();
  if (presupuestoId !== null) {
    await db.update(presupuesto).set({ ultimoAvisoEn: ts }).where(eq(presupuesto.id, presupuestoId)).run();
  }
  await enviarTelegram(texto, enlace);
}

/** Cuántos avisos se han creado de este presupuesto desde un instante dado. */
export async function avisosDesde(presupuestoId: number, desde: Date): Promise<number> {
  const fila = await db
    .select({ n: sql<number>`count(*)` })
    .from(aviso)
    .where(and(eq(aviso.presupuestoId, presupuestoId), gte(aviso.ts, desde)))
    .get();
  return Number(fila?.n ?? 0);
}
