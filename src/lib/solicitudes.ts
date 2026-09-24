// Las solicitudes: guardarlas y convertirlas en presupuesto. Es el núcleo; las
// Server Actions del panel y de /solicitar solo lo envuelven (y comprueban la
// sesión o los límites). Aquí no hay acciones: nada de esto se puede invocar
// desde fuera.
//
// El reparto de trabajo entre la IA y el servidor, que es la regla de la casa:
// la IA dice QUÉ partida cree que es; el servidor decide si existe, y es él
// quien pone el precio y el margen, copiados del banco. Lo que no encaja sale
// en amarillo y sin precio.
//
// Y una segunda regla: sin visita no hay presupuesto. Lo que llega de la web
// sale entero en amarillo y sin precio, aunque la IA reconozca la partida.
import { and, eq, sql } from "drizzle-orm";
import { db, partida, solicitud } from "@/db";
import { casarConceptos, extraerVisita, hayIa } from "./ia";
import { anadirLinea, crearPresupuesto, partidaPorCodigo, recalcular, type EntradaLinea } from "./presupuestos";
import { ahora, cargarReloj } from "./reloj";
import { tituloDeObra, type SolicitudWebDatos } from "./solicitud-web";
import { URGENCIAS, type ConceptoCrudo, type Origen, type Unidad, type Urgencia } from "./tipos";

/** Por debajo de esta confianza, la línea sale amarilla para que Manolo la mire. */
const CONFIANZA_MINIMA = 0.6;

const CAPITULO_SIN_BANCO = "Sin clasificar";

/* --------------------------------------------------------------- guardar */

export type NuevaSolicitud = {
  clienteNombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string;
  titulo: string;
  urgencia: Urgencia;
  textoOriginal: string;
  conceptos: ConceptoCrudo[];
  origen: Origen;
};

/** Mete una solicitud en la bandeja. Devuelve su id. */
export async function guardarSolicitud(nueva: NuevaSolicitud): Promise<number> {
  await cargarReloj();
  const urgencia: Urgencia = (URGENCIAS as readonly string[]).includes(nueva.urgencia)
    ? nueva.urgencia
    : "media";
  const fila = await db
    .insert(solicitud)
    .values({
      clienteNombre: nueva.clienteNombre.trim(),
      telefono: nueva.telefono?.trim() || null,
      email: nueva.email?.trim() || null,
      direccion: nueva.direccion.trim(),
      titulo: nueva.titulo.trim() || "Visita sin título",
      urgencia,
      textoOriginal: nueva.textoOriginal.trim(),
      conceptos: JSON.stringify(nueva.conceptos),
      origen: nueva.origen,
      estado: "pendiente",
      creadoEn: ahora(),
    })
    .returning({ id: solicitud.id })
    .get();
  return fila.id;
}

/** La solicitud que llega del formulario público, ya validada. */
export async function guardarSolicitudDeLaWeb(datos: SolicitudWebDatos): Promise<number> {
  return guardarSolicitud({
    clienteNombre: datos.nombre,
    telefono: datos.telefono,
    email: datos.email || null,
    direccion: datos.direccion,
    titulo: tituloDeObra(datos.obra),
    urgencia: datos.plazo,
    textoOriginal: datos.mensaje,
    // Lo que el cliente escribe no son conceptos medidos: se entienden al
    // convertir, y aun así salen sin precio.
    conceptos: [],
    origen: "cliente",
  });
}

/* ------------------------------------------------------------- convertir */

/**
 * El orden de los capítulos es el del banco tal y como se importó del CSV
 * (demoliciones, albañilería, fontanería, electricidad, alicatados…), que es el
 * orden en que se hace la obra: así el presupuesto se lee como uno de verdad.
 * Lo que no está en el banco va al final.
 */
async function ordenDeCapitulos(): Promise<Map<string, number>> {
  const filas = (
    await db
      .select({ capitulo: partida.capitulo, primera: sql<number>`min(${partida.id})` })
      .from(partida)
      .groupBy(partida.capitulo)
      .all()
  ).sort((a, b) => Number(a.primera) - Number(b.primera));

  const orden = new Map<string, number>();
  for (const fila of filas) orden.set(fila.capitulo, orden.size);
  return orden;
}

/** Una línea cruda: la que sale cuando no hay partida del banco que valga. */
function lineaAmarilla(
  concepto: ConceptoCrudo,
  motivo: string,
  confianza: number | null,
  capitulo = CAPITULO_SIN_BANCO,
): EntradaLinea {
  return {
    capitulo,
    descripcion: concepto.descripcion,
    unidad: (concepto.unidad ?? "ud") as Unidad,
    medicion: concepto.medicion ?? 1,
    amarilla: true,
    confianza,
    motivoIa: motivo,
  };
}

/** Las líneas de una visita de Manolo: con precio del banco lo que encaja. */
async function lineasDeUnaVisita(conceptos: ConceptoCrudo[]): Promise<EntradaLinea[]> {
  const entradas: EntradaLinea[] = [];
  try {
    const casaciones = await casarConceptos(conceptos);
    for (const casacion of casaciones) {
      const concepto = conceptos[casacion.indice];
      if (!concepto) continue;

      const delBanco = casacion.codigo ? await partidaPorCodigo(casacion.codigo) : null;

      if (!delBanco) {
        entradas.push(
          lineaAmarilla(
            concepto,
            casacion.codigo
              ? `La máquina propuso ${casacion.codigo}, que no está en el banco: ponle precio o cámbiala.`
              : casacion.motivo,
            casacion.confianza,
          ),
        );
        continue;
      }

      if (casacion.confianza < CONFIANZA_MINIMA) {
        entradas.push(
          lineaAmarilla(
            concepto,
            `Podría ser «${delBanco.nombre}» (${delBanco.codigo}), pero no está claro: ${casacion.motivo}`,
            casacion.confianza,
          ),
        );
        continue;
      }

      entradas.push({
        capitulo: delBanco.capitulo,
        descripcion: delBanco.nombre,
        unidad: delBanco.unidad as Unidad,
        medicion: casacion.medicion,
        precio: delBanco.precio,
        margenPct: delBanco.margenObjetivo,
        partidaId: delBanco.id,
        amarilla: false,
        confianza: casacion.confianza,
        motivoIa: casacion.motivo,
      });
    }
  } catch (e) {
    // Sin IA (o con la IA caída) el presupuesto se crea igual: todo en amarillo
    // y sin precio, que es exactamente lo que manda la regla de la casa.
    console.error("No se han podido casar las partidas:", e);
    for (const concepto of conceptos) {
      entradas.push(
        lineaAmarilla(
          concepto,
          "La máquina no ha podido casar esta línea con el banco: ponle el precio a mano.",
          null,
        ),
      );
    }
  }
  return entradas;
}

/**
 * Las líneas de una solicitud que llegó de la web. Nadie ha visto la obra, así
 * que ninguna lleva precio: la IA entiende qué pide el cliente y sugiere la
 * partida, pero la línea se queda en amarillo hasta que Manolo la mida.
 */
async function lineasSinVisita(textoOriginal: string, conceptos: ConceptoCrudo[]): Promise<EntradaLinea[]> {
  let deLaWeb = conceptos;
  if (deLaWeb.length === 0 && hayIa()) {
    try {
      deLaWeb = (await extraerVisita(textoOriginal)).conceptos;
    } catch (e) {
      console.error("No se ha podido entender la solicitud de la web:", e);
    }
  }
  if (deLaWeb.length === 0) return [];

  const sugerencias = new Map<number, { nombre: string; codigo: string; capitulo: string }>();
  try {
    for (const c of await casarConceptos(deLaWeb)) {
      const delBanco = c.codigo ? await partidaPorCodigo(c.codigo) : null;
      if (delBanco) sugerencias.set(c.indice, delBanco);
    }
  } catch (e) {
    console.error("No se han podido sugerir partidas para la solicitud de la web:", e);
  }

  return deLaWeb.map((concepto, i) => {
    const sugerida = sugerencias.get(i);
    return lineaAmarilla(
      concepto,
      sugerida
        ? `Sin visita no hay medición ni precio. Podría ser «${sugerida.nombre}» (${sugerida.codigo}): confírmalo al ver la obra.`
        : "Sin visita no hay medición ni precio: mídelo en la obra y ponle precio.",
      null,
      sugerida?.capitulo ?? CAPITULO_SIN_BANCO,
    );
  });
}

export type ResultadoConversion =
  | { ok: true; presupuestoId: number; amarillas: number; sinVisita: boolean }
  | { ok: false; mensaje: string };

/**
 * El núcleo de «Convertir»: crea el Borrador, casa cada concepto con el banco y
 * deja la solicitud marcada.
 *
 * Lo primero es reclamar la solicitud (pendiente → convertida en un UPDATE
 * condicionado): con dos clics a la vez, solo uno crea el presupuesto.
 */
export async function convertirEnPresupuesto(solicitudId: number): Promise<ResultadoConversion> {
  const fila = await db.select().from(solicitud).where(eq(solicitud.id, solicitudId)).get();
  if (!fila) return { ok: false, mensaje: "Esa solicitud ya no existe." };

  let conceptos: ConceptoCrudo[] = [];
  try {
    conceptos = JSON.parse(fila.conceptos) as ConceptoCrudo[];
  } catch {
    return { ok: false, mensaje: "Los conceptos de esta solicitud están corruptos." };
  }
  const sinVisita = fila.origen === "cliente";
  if (conceptos.length === 0 && !sinVisita) {
    return { ok: false, mensaje: "Esta solicitud no tiene conceptos que convertir." };
  }

  const reclamada = await db
    .update(solicitud)
    .set({ estado: "convertida" })
    .where(and(eq(solicitud.id, solicitudId), eq(solicitud.estado, "pendiente")))
    .run();
  if (reclamada.rowsAffected !== 1) {
    return { ok: false, mensaje: "Esa solicitud ya estaba convertida o descartada." };
  }

  try {
    const presupuestoId = await crearPresupuesto({
      clienteNombre: fila.clienteNombre,
      telefono: fila.telefono,
      email: fila.email,
      direccionObra: fila.direccion,
      titulo: fila.titulo,
      visitaEn: fila.creadoEn,
      solicitudId: fila.id,
    });

    const [entradas, orden] = await Promise.all([
      sinVisita ? lineasSinVisita(fila.textoOriginal, conceptos) : lineasDeUnaVisita(conceptos),
      ordenDeCapitulos(),
    ]);
    const posicion = (capitulo: string) => orden.get(capitulo) ?? orden.size + 1;
    const ordenadas = entradas
      .map((entrada, i) => ({ entrada, i }))
      .sort((a, b) => posicion(a.entrada.capitulo) - posicion(b.entrada.capitulo) || a.i - b.i);
    for (const [i, { entrada }] of ordenadas.entries()) {
      await anadirLinea(presupuestoId, { ...entrada, orden: i });
    }

    await recalcular(presupuestoId);
    await db.update(solicitud).set({ presupuestoId }).where(eq(solicitud.id, solicitudId)).run();

    return {
      ok: true,
      presupuestoId,
      amarillas: entradas.filter((e) => e.amarilla).length,
      sinVisita,
    };
  } catch (e) {
    // Si algo falla a medias, la solicitud vuelve a la bandeja para reintentar.
    await db
      .update(solicitud)
      .set({ estado: "pendiente" })
      .where(and(eq(solicitud.id, solicitudId), eq(solicitud.estado, "convertida")))
      .run();
    throw e;
  }
}

/* -------------------------------------------------------------- descartar */

export async function descartar(solicitudId: number): Promise<void> {
  await db
    .update(solicitud)
    .set({ estado: "descartada" })
    .where(and(eq(solicitud.id, solicitudId), eq(solicitud.estado, "pendiente")))
    .run();
}

/** Deshacer un descarte: vuelve a la bandeja. */
export async function recuperar(solicitudId: number): Promise<void> {
  await db
    .update(solicitud)
    .set({ estado: "pendiente" })
    .where(and(eq(solicitud.id, solicitudId), eq(solicitud.estado, "descartada")))
    .run();
}
