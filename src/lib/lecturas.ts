// El tracking de la página del cliente: quién abre, cuántas veces, desde dónde
// y cuánto rato se queda en cada sección.
//
// Dos cosas pasan cuando alguien abre un presupuesto enviado: se queda la
// lectura y el presupuesto pasa a Visto. Todo lo demás (el timeline, HOY, el
// aviso agrupado) se alimenta de aquí.
//
// DUEÑO: carril C.
import { randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, evento, eventoLectura, presupuesto } from "@/db";
import { avisarApertura } from "./avisos";
import { cambiarEstado, registrarEvento, tocarPulso } from "./eventos";
import { ahora, cargarReloj } from "./reloj";
import { SECCIONES, type Dispositivo, type Lectura, type Seccion } from "./tipos";

/** La cookie con la que contamos las visitas de un mismo navegador. */
export const COOKIE_VISITANTE = "mo_visitante";
/** Un año: el visitante se recuerda entre sesiones para que la 2.ª visita sea la 2.ª. */
export const VIDA_COOKIE_S = 365 * 24 * 60 * 60;

export function nuevoVisitante(): string {
  return randomBytes(9).toString("base64url");
}

const ES_SECCION = new Set<string>(SECCIONES);

/** Valida una sección que llega de fuera. Lo que no reconocemos, se descarta. */
export function seccionValida(valor: unknown): Seccion | null {
  return typeof valor === "string" && ES_SECCION.has(valor) ? (valor as Seccion) : null;
}

/**
 * El dispositivo a partir del tipo que da Next (`device.type` de userAgent()):
 * todo lo que no es móvil ni tablet se cuenta como ordenador.
 */
export function dispositivoDesdeTipo(tipo: string | undefined): Dispositivo {
  if (tipo === "mobile") return "movil";
  if (tipo === "tablet") return "tablet";
  return "ordenador";
}

/** En qué visita va este navegador sobre este presupuesto. */
async function visitaDe(presupuestoId: number, visitanteId: string): Promise<number> {
  const fila = await db
    .select({ n: sql<number>`max(${eventoLectura.visitaN})` })
    .from(eventoLectura)
    .where(
      and(
        eq(eventoLectura.presupuestoId, presupuestoId),
        eq(eventoLectura.visitanteId, visitanteId),
      ),
    )
    .get();
  return Number(fila?.n ?? 0);
}

/**
 * Suma los segundos leídos de una sección al evento «abierto» de esa visita.
 *
 * El timeline enseña UNA entrada por apertura con el desglose por secciones
 * debajo («las partidas: 1 min 36 s · el total: 1 min 8 s»), no una entrada por
 * sección: así se lee como lo que es, una visita.
 */
async function acumularSeccion(
  presupuestoId: number,
  visitanteId: string,
  visitaN: number,
  seccion: Seccion,
  duracionS: number,
): Promise<void> {
  const candidatos = await db
    .select({ id: evento.id, meta: evento.meta })
    .from(evento)
    .where(and(eq(evento.presupuestoId, presupuestoId), eq(evento.tipo, "abierto")))
    .orderBy(desc(evento.ts))
    .limit(20)
    .all();

  for (const c of candidatos) {
    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(c.meta) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (meta.visitanteId !== visitanteId || meta.visitaN !== visitaN) continue;

    const secciones = Array.isArray(meta.secciones) ? ([...meta.secciones] as [Seccion, number][]) : [];
    const i = secciones.findIndex(([s]) => s === seccion);
    if (i >= 0) secciones[i] = [seccion, secciones[i][1] + duracionS];
    else secciones.push([seccion, duracionS]);

    // En el orden en que se lee la página, no en el que llegan los avisos.
    secciones.sort((a, b) => SECCIONES.indexOf(a[0]) - SECCIONES.indexOf(b[0]));

    meta.secciones = secciones;
    meta.segundos = secciones.reduce((s, [, d]) => s + d, 0);
    await db.update(evento).set({ meta: JSON.stringify(meta) }).where(eq(evento.id, c.id)).run();
    await tocarPulso();
    return;
  }
}

/**
 * Registra una lectura de la página del cliente.
 *
 * Sin sección = una apertura: cuenta la visita, alimenta el timeline, pasa el
 * presupuesto de Enviado a Visto y dispara el aviso agrupado.
 * Con sección = el rato que el cliente ha pasado en ese bloque.
 *
 * Nunca lanza hacia fuera lo que no sea un fallo real de base: un tracking roto
 * no puede tumbar la página del cliente.
 */
export async function registrarLectura(lectura: Lectura): Promise<void> {
  await cargarReloj();
  const p = await db
    .select({ id: presupuesto.id, estado: presupuesto.estado })
    .from(presupuesto)
    .where(eq(presupuesto.id, lectura.presupuestoId))
    .get();
  if (!p) return;

  const ts = ahora();
  const comun = {
    presupuestoId: p.id,
    visitanteId: lectura.visitanteId,
    ip: lectura.ip ?? null,
    ciudad: lectura.ciudad ?? null,
    pais: lectura.pais ?? null,
    dispositivo: lectura.dispositivo ?? null,
  };

  /* ------------------------------------------------------------ apertura */
  if (lectura.seccion == null) {
    const visitaN = (await visitaDe(p.id, lectura.visitanteId)) + 1;
    await db.insert(eventoLectura)
      .values({ ...comun, visitaN, seccion: null, duracionS: null, ts })
      .run();

    const expirado = p.estado === "expirado";
    await registrarEvento(
      p.id,
      "abierto",
      {
        visitanteId: lectura.visitanteId,
        visitaN,
        ciudad: comun.ciudad,
        pais: comun.pais,
        dispositivo: comun.dispositivo,
        expirado,
        secciones: [],
        segundos: 0,
      },
      ts,
    );

    // La primera apertura es la que pasa de Enviado a Visto.
    if (p.estado === "enviado") {
      await cambiarEstado(p.id, "visto", "el cliente lo ha abierto");
    }

    await avisarApertura(p.id, {
      visitaN,
      ciudad: comun.ciudad,
      pais: comun.pais,
      dispositivo: comun.dispositivo,
    });
    return;
  }

  /* ------------------------------------------------------------- sección */
  const duracionS = Math.round(lectura.duracionS ?? 0);
  // Un vistazo de menos de un segundo no es una lectura: es ruido de scroll.
  if (duracionS < 1) return;

  const visitaN = Math.max(1, await visitaDe(p.id, lectura.visitanteId));
  await db.insert(eventoLectura)
    .values({ ...comun, visitaN, seccion: lectura.seccion, duracionS, ts })
    .run();

  await acumularSeccion(p.id, lectura.visitanteId, visitaN, lectura.seccion, duracionS);
}
