// Los avisos: la campana del panel y, si hay claves, el móvil del jefe.
//
// La regla de la agrupación, que es lo que hace que esto aguante que cien
// personas abran el mismo presupuesto a la vez: como mucho UN aviso por minuto
// y presupuesto. Las aperturas que caen dentro de ese minuto no se pierden —
// el siguiente aviso las cuenta y dice de cuántas ciudades vinieron.
//
// Con la base asíncrona, «mirar si ha pasado el minuto» y «apuntar la hora del
// aviso» son dos viajes, y cien aperturas simultáneas se colarían entre ellos.
// Por eso el aviso del minuto se RECLAMA con un UPDATE condicionado: solo sale
// quien encuentra la hora anterior tal y como la leyó. Las que pierden esa
// carrera no se pierden: el barrido del polling las recoge en el agrupado.
//
// DUEÑO: carril C.
import { and, desc, eq, gt, gte, isNull, sql } from "drizzle-orm";
import { aviso, cliente, db, eventoLectura, presupuesto } from "@/db";
import { formatoDispositivo, formatoEurosCorto, formatoUbicacion, formatoVisita } from "./formato";
import { ahora, cargarReloj, UN_MINUTO } from "./reloj";
import { enviarTelegram, urlDeLaApp } from "./telegram";

/** Hasta dónde mira atrás el barrido de aperturas sin avisar. */
const VENTANA_BARRIDO = 10 * UN_MINUTO;

/* ---------------------------------------------------------------- lectura */

/** Cuántos avisos sin leer tiene la campana. */
export async function avisosSinLeer(): Promise<number> {
  const fila = await db.select({ n: sql<number>`count(*)` }).from(aviso).where(eq(aviso.leido, false)).get();
  return Number(fila?.n ?? 0);
}

/** Los últimos avisos, los no leídos primero por fecha. */
export async function ultimosAvisos(limite = 20) {
  return db.select().from(aviso).orderBy(desc(aviso.ts)).limit(limite).all();
}

/** Los avisos de un presupuesto: el timeline de su ficha los enseña también. */
export async function avisosDe(presupuestoId: number) {
  return db
    .select()
    .from(aviso)
    .where(eq(aviso.presupuestoId, presupuestoId))
    .orderBy(desc(aviso.ts))
    .all();
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

/** Cuántos avisos se han creado de este presupuesto desde un instante dado. */
export async function avisosDesde(presupuestoId: number, desde: Date): Promise<number> {
  const fila = await db
    .select({ n: sql<number>`count(*)` })
    .from(aviso)
    .where(and(eq(aviso.presupuestoId, presupuestoId), gte(aviso.ts, desde)))
    .get();
  return Number(fila?.n ?? 0);
}

/* -------------------------------------------------------------- escritura */

/** El enlace del panel que acompaña a cada aviso. */
export function enlaceDelPanel(presupuestoId: number | null): string {
  return presupuestoId ? `${urlDeLaApp()}/panel/presupuestos/${presupuestoId}` : `${urlDeLaApp()}/panel`;
}

/**
 * Deja el aviso en la campana y lo manda al móvil del jefe.
 * NO agrupa: quien llama decide si toca avisar. Para las aperturas, que es
 * donde la agrupación importa, usa avisarApertura().
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

/* ------------------------------------------------ la agrupación por minuto */

type Cabecera = {
  id: number;
  numero: string;
  titulo: string;
  direccionObra: string;
  total: number;
  estado: string;
  clienteNombre: string;
  ultimoAvisoEn: Date | null;
};

async function cabecera(presupuestoId: number): Promise<Cabecera | null> {
  const fila = await db
    .select({
      id: presupuesto.id,
      numero: presupuesto.numero,
      titulo: presupuesto.titulo,
      direccionObra: presupuesto.direccionObra,
      total: presupuesto.total,
      estado: presupuesto.estado,
      clienteNombre: cliente.nombre,
      ultimoAvisoEn: presupuesto.ultimoAvisoEn,
    })
    .from(presupuesto)
    .innerJoin(cliente, eq(presupuesto.clienteId, cliente.id))
    .where(eq(presupuesto.id, presupuestoId))
    .get();
  return fila ?? null;
}

/**
 * Reclama el aviso de este minuto: apunta `ts` como último aviso SOLO si el
 * último aviso sigue siendo el que se leyó. Devuelve si lo ha conseguido.
 */
async function reclamarElMinuto(presupuestoId: number, anterior: Date | null, ts: Date): Promise<boolean> {
  const hecho = await db
    .update(presupuesto)
    .set({ ultimoAvisoEn: ts })
    .where(
      and(
        eq(presupuesto.id, presupuestoId),
        anterior ? eq(presupuesto.ultimoAvisoEn, anterior) : isNull(presupuesto.ultimoAvisoEn),
      ),
    )
    .run();
  return hecho.rowsAffected === 1;
}

/** «👀 María Gómez acaba de abrir tu presupuesto de 14.300 € · Baño · … · 2.ª visita · móvil · Barcelona» */
function textoDeUnaApertura(
  p: Cabecera,
  datos: { visitaN: number; ciudad: string | null; pais: string | null; dispositivo: string | null },
  expirado: boolean,
): string {
  const cola = [
    p.titulo,
    p.direccionObra,
    formatoVisita(datos.visitaN),
    formatoDispositivo(datos.dispositivo),
    formatoUbicacion(datos.ciudad, datos.pais),
  ].join(" · ");
  return expirado
    ? `🔁 ${p.clienteNombre} ha vuelto a abrir un presupuesto caducado de ${formatoEurosCorto(p.total)} · ${cola} · es una señal de compra: llámale`
    : `👀 ${p.clienteNombre} acaba de abrir tu presupuesto de ${formatoEurosCorto(p.total)} · ${cola}`;
}

/** Las aperturas de un presupuesto desde un instante: cuántas y de qué ciudades. */
async function aperturasDesde(presupuestoId: number, desde: Date): Promise<{ cuantas: number; ciudades: number }> {
  const fila = await db
    .select({
      cuantas: sql<number>`count(*)`,
      ciudades: sql<number>`count(distinct ${eventoLectura.ciudad})`,
    })
    .from(eventoLectura)
    .where(
      and(
        eq(eventoLectura.presupuestoId, presupuestoId),
        isNull(eventoLectura.seccion),
        gt(eventoLectura.ts, desde),
      ),
    )
    .get();
  return { cuantas: Number(fila?.cuantas ?? 0), ciudades: Number(fila?.ciudades ?? 0) };
}

/** «… · 12 ciudades», «… · 1 ciudad», o nada si no sabemos de dónde vinieron. */
function colaDeCiudades(ciudades: number): string {
  if (ciudades <= 0) return " · ubicación desconocida";
  return ciudades === 1 ? " · 1 ciudad" : ` · ${ciudades} ciudades`;
}

/** Deja el aviso en la campana y lo manda, sin volver a tocar la hora (ya reclamada). */
async function avisarYa(presupuestoId: number, texto: string, ts: Date): Promise<void> {
  await db.insert(aviso).values({ presupuestoId, texto, leido: false, ts }).run();
  await enviarTelegram(texto, enlaceDelPanel(presupuestoId));
}

/**
 * El aviso de una apertura, respetando la agrupación.
 *
 * · Si el presupuesto lleva más de un minuto sin avisar, sale el aviso con
 *   nombre, importe, visita, dispositivo y ciudad.
 * · Si dentro de ese minuto ya se avisó, esta apertura NO manda nada: queda
 *   contada en evento_lectura y la recoge el siguiente aviso (o el barrido de
 *   avisarAperturasPendientes(), que llama el polling cada 3 s).
 * · Cuando hay más de una apertura acumulada, el aviso que sale es el
 *   agrupado: «👀 37 aperturas nuevas del presupuesto de 14.300 € en el último
 *   minuto · 12 ciudades».
 */
export async function avisarApertura(
  presupuestoId: number,
  datos: { visitaN: number; ciudad: string | null; pais: string | null; dispositivo: string | null },
): Promise<void> {
  await cargarReloj();
  const p = await cabecera(presupuestoId);
  if (!p) return;
  const ts = ahora();
  if (p.ultimoAvisoEn && ts.getTime() - p.ultimoAvisoEn.getTime() < UN_MINUTO) return; // se acumula y calla
  if (!(await reclamarElMinuto(presupuestoId, p.ultimoAvisoEn, ts))) return; // otra apertura se lo ha llevado

  const expirado = p.estado === "expirado";
  // Las aperturas acumuladas desde el último aviso, incluida la de ahora mismo.
  // Nunca se mira más atrás de la ventana: lo de hace horas es historia, no
  // una apertura pendiente de avisar.
  const ventana = new Date(ts.getTime() - VENTANA_BARRIDO);
  const desde = p.ultimoAvisoEn && p.ultimoAvisoEn > ventana ? p.ultimoAvisoEn : ventana;
  const acumuladas = await aperturasDesde(presupuestoId, desde);

  const texto =
    acumuladas.cuantas > 1
      ? `👀 ${acumuladas.cuantas} aperturas nuevas del presupuesto de ${formatoEurosCorto(p.total)} en el último minuto${colaDeCiudades(acumuladas.ciudades)}`
      : textoDeUnaApertura(p, datos, expirado);
  await avisarYa(presupuestoId, texto, ts);
}

/**
 * El barrido que cierra el agujero de la agrupación: si a un presupuesto le
 * quedaron aperturas sin avisar y ya ha pasado el minuto, el aviso agrupado
 * sale aunque nadie vuelva a abrir. Lo llama /api/pulso en cada latido, desde
 * cada pestaña abierta: por eso cada aviso se reclama antes de salir.
 */
export async function avisarAperturasPendientes(): Promise<number> {
  await cargarReloj();
  const ts = ahora();
  const limite = new Date(ts.getTime() - UN_MINUTO);
  // Solo se persigue lo reciente: una apertura de hace horas es historia, no un
  // aviso pendiente. Sin este tope, el primer latido tras arrancar avisaría de
  // aperturas viejas del seed.
  const ventana = new Date(ts.getTime() - VENTANA_BARRIDO);

  // Presupuestos con aperturas que llegaron DENTRO del minuto de gracia de su
  // último aviso (las que se callaron), con ese minuto ya cumplido. Una apertura
  // posterior al minuto no es cosa del barrido: avisa ella misma, con nombre y
  // ciudad, y el barrido no debe adelantársele con un agrupado.
  const candidatos = await db
    .select({
      id: presupuesto.id,
      total: presupuesto.total,
      ultimoAvisoEn: presupuesto.ultimoAvisoEn,
      cuantas: sql<number>`count(*)`,
      ciudades: sql<number>`count(distinct ${eventoLectura.ciudad})`,
    })
    .from(eventoLectura)
    .innerJoin(presupuesto, eq(eventoLectura.presupuestoId, presupuesto.id))
    .where(
      and(
        isNull(eventoLectura.seccion),
        gt(eventoLectura.ts, ventana),
        sql`${presupuesto.ultimoAvisoEn} is not null`,
        sql`${presupuesto.ultimoAvisoEn} <= ${limite.getTime()}`,
        sql`${eventoLectura.ts} > ${presupuesto.ultimoAvisoEn}`,
        sql`${eventoLectura.ts} < ${presupuesto.ultimoAvisoEn} + ${UN_MINUTO}`,
      ),
    )
    .groupBy(presupuesto.id)
    .all();

  let enviados = 0;
  for (const c of candidatos) {
    const cuantas = Number(c.cuantas);
    if (cuantas <= 0) continue;
    if (!(await reclamarElMinuto(c.id, c.ultimoAvisoEn, ts))) continue; // otro latido se lo ha llevado
    const texto =
      cuantas === 1
        ? `👀 1 apertura nueva del presupuesto de ${formatoEurosCorto(c.total)} en el último minuto${colaDeCiudades(Number(c.ciudades))}`
        : `👀 ${cuantas} aperturas nuevas del presupuesto de ${formatoEurosCorto(c.total)} en el último minuto${colaDeCiudades(Number(c.ciudades))}`;
    await avisarYa(c.id, texto, ts);
    enviados++;
  }
  return enviados;
}
