// El seed de La Máquina de Obras: datos de ejemplo deterministas, con fechas
// relativas al día en que se ejecuta y las cifras de las diapositivas cuadradas
// al céntimo. Si alguna cifra no cuadra, el seed aborta.
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  aviso,
  cliente,
  db,
  evento,
  eventoLectura,
  linea,
  negocio,
  partida,
  peticionWeb,
  plantilla,
  presupuesto,
  pulso,
  solicitud,
  tareaProgramada,
} from "./index";
import { importarBanco, leerBancoDelDisco } from "./precios";
import {
  CLIENTES,
  EMPRESA,
  PLANTILLAS,
  PRESUPUESTOS,
  SOLICITUDES,
  type AperturaSeed,
  type LineaSeed,
  type PresupuestoSeed,
} from "./datos";
import { calcularImportes } from "@/lib/importes";
import {
  ahora,
  cargarReloj,
  inicioDelDia,
  masDias,
  olvidarDesplazamiento,
  UN_DIA,
  UNA_HORA,
  UN_MINUTO,
} from "@/lib/reloj";
import { formatoEurosCorto } from "@/lib/formato";
import type { Estado, LineaCalculo, TipoTarea, Unidad } from "@/lib/tipos";

/* ------------------------------------------------------------- utilidades */

const ORDEN_CAPITULOS = [
  "Demoliciones",
  "Albañilería",
  "Fontanería",
  "Electricidad",
  "Alicatados y solados",
  "Carpintería",
  "Pintura",
  "Cocina",
  "Climatización",
  "Gestión y varios",
  "Sin clasificar",
];

/** Un token de enlace público que no se puede adivinar. */
function nuevoToken(): string {
  return randomBytes(16).toString("base64url");
}

function mcd(a: number, b: number): number {
  return b === 0 ? a : mcd(b, a % b);
}

/** Inverso de a módulo m (con mcd(a, m) = 1). */
function inversoModular(a: number, m: number): number {
  let [viejoR, r] = [((a % m) + m) % m, m];
  let [viejoS, s] = [1, 0];
  while (r !== 0) {
    const q = Math.floor(viejoR / r);
    [viejoR, r] = [r, viejoR - q * r];
    [viejoS, s] = [s, viejoS - q * s];
  }
  return ((viejoS % m) + m) % m;
}

/**
 * Reparte `diff` céntimos entre dos partidas de precio p1 y p2 euros (coprimos),
 * devolviendo las mediciones en centésimas. Elige la solución cuya primera
 * medición queda más cerca de `aprox`, para que el presupuesto siga siendo creíble.
 */
function resolverAjuste(diff: number, p1: number, p2: number, aprox: number): [number, number] {
  if (mcd(p1, p2) !== 1) throw new Error(`Las partidas de ajuste ${p1} y ${p2} no son coprimas`);
  if (diff <= 0) throw new Error(`No queda hueco para el ajuste: faltan ${diff} céntimos`);
  const inv = inversoModular(p1 % p2, p2);
  let a = ((diff % p2) * inv) % p2;
  a += p2 * Math.round((aprox - a) / p2);
  let b = (diff - p1 * a) / p2;
  while (b < 1 && a > p2) {
    a -= p2;
    b = (diff - p1 * a) / p2;
  }
  while (a < 1) {
    a += p2;
    b = (diff - p1 * a) / p2;
  }
  if (a < 1 || b < 1 || !Number.isInteger(a) || !Number.isInteger(b) || p1 * a + p2 * b !== diff) {
    throw new Error(`No se pudo repartir ${diff} céntimos entre ${p1} € y ${p2} € (a=${a}, b=${b})`);
  }
  return [a, b];
}

/** Milisegundos que hay que sumar a UTC para tener la hora de Madrid en esa fecha. */
function desfaseMadrid(fecha: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  const v = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return (
    Date.UTC(v("year"), v("month") - 1, v("day"), v("hour") % 24, v("minute"), v("second")) -
    Math.floor(fecha.getTime() / 1000) * 1000
  );
}

/** El día `dias` antes de hoy, a la hora indicada en Europe/Madrid. */
function enDia(ref: Date, dias: number, hora: number, minuto = 0): Date {
  const desfase = desfaseMadrid(ref);
  const local = new Date(ref.getTime() + desfase - dias * UN_DIA);
  const objetivo =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) +
    hora * UNA_HORA +
    minuto * UN_MINUTO;
  // El desfase puede cambiar con el horario de verano: se recalcula en destino.
  const primera = objetivo - desfase;
  const propio = desfaseMadrid(new Date(primera));
  return new Date(propio === desfase ? primera : objetivo - propio);
}

const HORAS_VISITA = [9, 10, 11, 12, 16, 17, 18];

function textoSeguimiento(
  base: string,
  datos: { cliente: string; obra: string; total: string; dias: string },
): string {
  return base
    .replaceAll("{cliente}", datos.cliente.split(" ")[0])
    .replaceAll("{obra}", datos.obra.toLowerCase())
    .replaceAll("{total}", datos.total)
    .replaceAll("{dias}", datos.dias);
}

/** «3 días» contados entre dos instantes, sin mirar el reloj de la aplicación. */
function diasQueQuedaban(desde: Date, hasta: Date): string {
  const dias = Math.floor((hasta.getTime() - desde.getTime()) / UN_DIA);
  if (dias <= 0) return "menos de un día";
  return dias === 1 ? "1 día" : `${dias} días`;
}

const ASUNTOS: Record<TipoTarea, string> = {
  seguimiento_1: "¿Has podido ver el presupuesto?",
  seguimiento_2: "¿Lo ajustamos por fases?",
  cierre: "Tu presupuesto caduca pronto",
};

/* ------------------------------------------------------------------ seed */

export async function sembrar() {
  // 1 · La base se queda vacía.
  for (const tabla of [
    aviso,
    evento,
    eventoLectura,
    tareaProgramada,
    linea,
    presupuesto,
    solicitud,
    plantilla,
    cliente,
    partida,
    negocio,
    pulso,
    peticionWeb,
  ]) {
    await db.delete(tabla).run();
  }
  await db.run(sql`delete from sqlite_sequence`);

  // 2 · El negocio, con el reloj sin desplazar: a partir de aquí ahora() es la hora real.
  await db.insert(negocio)
    .values({
      id: 1,
      nombre: EMPRESA.nombre,
      cif: EMPRESA.cif,
      direccion: EMPRESA.direccion,
      telefono: EMPRESA.telefono,
      email: EMPRESA.email,
      colorMarca: EMPRESA.colorMarca,
      ivaPct: EMPRESA.ivaPct,
      condiciones: EMPRESA.condiciones,
      seguimiento1: EMPRESA.seguimiento1,
      seguimiento2: EMPRESA.seguimiento2,
      seguimiento3: EMPRESA.seguimiento3,
      caducidadDias: EMPRESA.caducidadDias,
      fechaAlta: new Date(0),
      relojOffsetMs: 0,
      datosEjemplo: true,
    })
    .run();
  olvidarDesplazamiento();
  await cargarReloj();
  const REF = ahora();
  const fechaAlta = enDia(REF, EMPRESA.diasDesdeAlta, 8, 30);
  await db.update(negocio).set({ fechaAlta }).run();
  await db.insert(pulso).values({ id: 1, version: 1, actualizadoEn: REF }).run();

  // 3 · El banco de precios.
  const banco = leerBancoDelDisco();
  await importarBanco(banco);
  const partidas = new Map((await db.select().from(partida).all()).map((p) => [p.codigo, p] as const));

  // 4 · Los clientes.
  const clienteIds: number[] = [];
  for (const [i, c] of CLIENTES.entries()) {
    const creado = enDia(REF, 100 - i * 3, 11, 0);
    const fila = await db
      .insert(cliente)
      .values({ nombre: c.nombre, telefono: c.telefono, email: c.email, notas: c.notas ?? null, creadoEn: creado })
      .returning({ id: cliente.id })
      .get();
    clienteIds.push(fila.id);
  }

  // 5 · Los presupuestos, numerados por orden de creación.
  const ordenados = [...PRESUPUESTOS].sort((a, b) => b.visita - a.visita);
  const resumen: {
    ref: string;
    id: number;
    estado: Estado;
    total: number;
    enviadoEn: Date | null;
    cerradoEn: Date | null;
    visitaEn: Date;
    ajuste?: string;
  }[] = [];

  for (const [indice, def] of ordenados.entries()) {
    const visitaEn = enDia(REF, def.visita, HORAS_VISITA[indice % HORAS_VISITA.length], 30);
    const creadoEn = new Date(visitaEn.getTime() + UNA_HORA);
    const enviadoEn = def.envio === undefined ? null : enDia(REF, def.visita - def.envio, 19, 45);
    const caducidadDias = def.caducidad ?? EMPRESA.caducidadDias;
    const validoHasta = enviadoEn ? masDias(enviadoEn, caducidadDias) : null;
    const numero = `${creadoEn.getFullYear()}-${String(indice + 1).padStart(3, "0")}`;

    // 5.1 · Las líneas del banco.
    type Fila = {
      codigo: string | null;
      capitulo: string;
      descripcion: string;
      unidad: Unidad;
      medicion: number;
      precio: number;
      margenPct: number;
      opcional: boolean;
      amarilla: boolean;
      confianza: number | null;
      motivoIa: string | null;
      partidaId: number | null;
    };
    const filas: Fila[] = [];
    const meter = ([codigo, medicion, marca]: LineaSeed) => {
      const p = partidas.get(codigo);
      if (!p) throw new Error(`${def.ref}: el código ${codigo} no está en el banco de precios`);
      filas.push({
        codigo,
        capitulo: p.capitulo,
        descripcion: p.nombre,
        unidad: p.unidad as Unidad,
        medicion,
        precio: p.precio,
        margenPct: p.margenObjetivo,
        opcional: marca === "opcional",
        amarilla: false,
        confianza: null,
        motivoIa: null,
        partidaId: p.id,
      });
    };
    def.lineas.forEach(meter);

    // 5.2 · El ajuste que clava el importe objetivo.
    let notaAjuste: string | undefined;
    if (def.total !== undefined) {
      if (!def.ajuste) throw new Error(`${def.ref}: hay total objetivo pero no hay líneas de ajuste`);
      const baseObjetivo = Math.round(def.total / (1 + EMPRESA.ivaPct / 100));
      const totalDelObjetivo = Math.round(baseObjetivo * (1 + EMPRESA.ivaPct / 100));
      if (totalDelObjetivo !== def.total) {
        throw new Error(
          `${def.ref}: con IVA del ${EMPRESA.ivaPct} % no existe base que dé ${def.total} céntimos`,
        );
      }
      const fijas = filas
        .filter((f) => !f.opcional)
        .reduce((suma, f) => suma + Math.round(f.precio * f.medicion), 0);
      const pa = partidas.get(def.ajuste.a);
      const pb = partidas.get(def.ajuste.b);
      if (!pa || !pb) throw new Error(`${def.ref}: partidas de ajuste desconocidas`);
      const precioA = pa.precio / 100;
      const precioB = pb.precio / 100;
      const hueco = baseObjetivo - fijas;
      // Se busca el reparto que deja la segunda medición cerca de lo pedido.
      const aprox = Math.round((hueco - precioB * (def.ajuste.bAprox ?? 900)) / precioA);
      const [a, b] = resolverAjuste(hueco, precioA, precioB, aprox);
      meter([pa.codigo, a / 100]);
      meter([pb.codigo, b / 100]);
      notaAjuste = `${pa.codigo} ${a / 100} · ${pb.codigo} ${b / 100}`;
    }

    // 5.3 · Las líneas fuera del banco: amarillas y sin precio.
    for (const am of def.amarillas ?? []) {
      filas.push({
        codigo: null,
        capitulo: am.capitulo,
        descripcion: am.descripcion,
        unidad: am.unidad,
        medicion: am.medicion,
        precio: 0,
        margenPct: 0,
        opcional: false,
        amarilla: true,
        confianza: 0,
        motivoIa: am.motivoIa,
        partidaId: null,
      });
    }

    filas.sort((x, y) => {
      const ci = ORDEN_CAPITULOS.indexOf(x.capitulo) - ORDEN_CAPITULOS.indexOf(y.capitulo);
      return ci !== 0 ? ci : (x.codigo ?? "zzz").localeCompare(y.codigo ?? "zzz");
    });

    const paraCalculo: LineaCalculo[] = filas.map((f) => ({
      medicion: f.medicion,
      precio: f.precio,
      margenPct: f.margenPct,
      opcional: f.opcional,
      elegida: !f.opcional,
    }));
    const importes = calcularImportes(paraCalculo, EMPRESA.ivaPct, def.descuento ?? 0);
    if (def.total !== undefined && importes.total !== def.total) {
      throw new Error(
        `${def.ref}: el total salió ${importes.total} y se esperaba ${def.total} céntimos`,
      );
    }

    const respondioEn = def.respuesta ? enDia(REF, def.respuesta.dias, 10, 20) : null;
    const firmadoEn = def.firma ? enDia(REF, def.firma.dias, def.firma.hora, 24) : null;
    const cerradoEn =
      def.estado === "expirado"
        ? validoHasta
        : firmadoEn ?? (def.cerrado !== undefined ? enDia(REF, def.cerrado, 12, 10) : null);

    const fila = await db
      .insert(presupuesto)
      .values({
        numero,
        token: nuevoToken(),
        clienteId: clienteIds[def.cliente],
        direccionObra: def.direccion,
        titulo: def.titulo,
        estado: def.estado,
        ivaPct: EMPRESA.ivaPct,
        descuentoPct: def.descuento ?? 0,
        base: importes.base,
        ivaImporte: importes.ivaImporte,
        total: importes.total,
        coste: importes.coste,
        margenPct: importes.margenPct,
        caducidadDias,
        validoHasta,
        visitaEn,
        creadoEn,
        enviadoEn,
        cerradoEn,
        motivoPerdido: def.motivo ?? null,
        respondioEn,
        respuestaTexto: def.respuesta?.texto ?? null,
        firmaPng: def.firma ? FIRMA_PNG : null,
        firmadoEn,
        firmaIp: def.firma?.ip ?? null,
        firmaDispositivo: def.firma?.dispositivo ?? null,
        ultimoAvisoEn: null,
        solicitudId: null,
        plantillaId: null,
      })
      .returning({ id: presupuesto.id })
      .get();

    for (const [orden, f] of filas.entries()) {
      await db.insert(linea)
        .values({
          presupuestoId: fila.id,
          partidaId: f.partidaId,
          capitulo: f.capitulo,
          descripcion: f.descripcion,
          unidad: f.unidad,
          medicion: f.medicion,
          precio: f.precio,
          precioManual: false,
          margenPct: f.margenPct,
          total: Math.round(f.precio * f.medicion),
          confianza: f.confianza,
          amarilla: f.amarilla,
          opcional: f.opcional,
          elegida: !f.opcional,
          orden,
          motivoIa: f.motivoIa,
        })
        .run();
    }

    // 5.4 · El timeline, las lecturas, las tareas y los avisos.
    const nombreCliente = CLIENTES[def.cliente].nombre;
    const eventos: { tipo: string; meta: Record<string, unknown>; ts: Date }[] = [
      { tipo: "creado", meta: { titulo: def.titulo }, ts: creadoEn },
    ];
    const avisos: { texto: string; ts: Date }[] = [];

    if (enviadoEn) {
      eventos.push({ tipo: "enviado", meta: { total: importes.total, validoHasta }, ts: enviadoEn });
    }

    const aperturas = [...(def.aperturas ?? [])].sort((a, b) => b.dias - a.dias);
    let primeraApertura: Date | null = null;
    for (const ap of aperturas) {
      const ts = enDia(REF, ap.dias, ap.hora, ap.minuto ?? 0);
      primeraApertura ??= ts;
      const visitanteId = `vis-${fila.id}-${ap.ip.replaceAll(".", "-")}`;
      await db.insert(eventoLectura)
        .values({
          presupuestoId: fila.id,
          visitanteId,
          visitaN: ap.visitaN,
          seccion: null,
          duracionS: null,
          ip: ap.ip,
          ciudad: ap.ciudad,
          pais: ap.pais ?? "ES",
          dispositivo: ap.dispositivo,
          ts,
        })
        .run();
      let desplazamiento = 4;
      for (const [seccion, duracion] of ap.secciones) {
        await db.insert(eventoLectura)
          .values({
            presupuestoId: fila.id,
            visitanteId,
            visitaN: ap.visitaN,
            seccion,
            duracionS: duracion,
            ip: ap.ip,
            ciudad: ap.ciudad,
            pais: ap.pais ?? "ES",
            dispositivo: ap.dispositivo,
            ts: new Date(ts.getTime() + desplazamiento * 1000),
          })
          .run();
        desplazamiento += duracion;
      }
      eventos.push({
        tipo: "abierto",
        meta: {
          visitaN: ap.visitaN,
          ciudad: ap.ciudad,
          pais: ap.pais ?? "ES",
          dispositivo: ap.dispositivo,
          secciones: ap.secciones,
          segundos: ap.secciones.reduce((s, [, d]) => s + d, 0),
          expirado: def.estado === "expirado",
        },
        ts,
      });
      if (ap.dias <= 3) {
        avisos.push({
          texto:
            def.estado === "expirado"
              ? `🔁 ${nombreCliente} ha vuelto a abrir un presupuesto caducado de ${formatoEurosCorto(importes.total)} · ${def.titulo} · ${ap.visitaN}.ª visita`
              : `👀 ${nombreCliente} acaba de abrir tu presupuesto de ${formatoEurosCorto(importes.total)} · ${def.titulo} · ${ap.visitaN}.ª visita`,
          ts,
        });
      }
    }

    if (primeraApertura && enviadoEn) {
      eventos.push({ tipo: "cambio_estado", meta: { a: "visto", porque: "el cliente lo ha abierto" }, ts: primeraApertura });
    }

    if (respondioEn) {
      eventos.push({ tipo: "respuesta_cliente", meta: { texto: def.respuesta!.texto }, ts: respondioEn });
      eventos.push({
        tipo: "cambio_estado",
        meta: { a: "en_conversacion", porque: "el cliente ha escrito" },
        ts: respondioEn,
      });
      eventos.push({
        tipo: "seguimiento_cancelado",
        meta: { porque: "el cliente ha respondido" },
        ts: new Date(respondioEn.getTime() + 1000),
      });
      if (def.respuesta!.dias <= 3) {
        avisos.push({
          texto: `💬 ${nombreCliente} tiene dudas sobre el presupuesto de ${formatoEurosCorto(importes.total)} · los seguimientos se han pausado · llámale`,
          ts: respondioEn,
        });
      }
    }

    // Las tres tareas de persecución.
    if (enviadoEn) {
      const dias: Record<TipoTarea, number> = { seguimiento_1: 3, seguimiento_2: 7, cierre: 14 };
      const textosBase: Record<TipoTarea, string> = {
        seguimiento_1: EMPRESA.seguimiento1,
        seguimiento_2: EMPRESA.seguimiento2,
        cierre: EMPRESA.seguimiento3,
      };
      let alarmaPuesta = false;
      for (const tipo of ["seguimiento_1", "seguimiento_2", "cierre"] as TipoTarea[]) {
        let ejecutarEn = masDias(enviadoEn, dias[tipo]);
        // Los días que quedaban de validez EN EL MOMENTO de salir el seguimiento,
        // no los que quedan ahora.
        const texto = textoSeguimiento(textosBase[tipo], {
          cliente: nombreCliente,
          obra: def.titulo,
          total: formatoEurosCorto(importes.total),
          dias: validoHasta ? diasQueQuedaban(ejecutarEn, validoHasta) : "unos días",
        });
        let estado: "pendiente" | "enviada" | "cancelada";
        if (cerradoEn && ejecutarEn >= cerradoEn) estado = "cancelada";
        else if (respondioEn && ejecutarEn >= respondioEn) estado = "cancelada";
        else if (ejecutarEn <= REF) estado = "enviada";
        else estado = "pendiente";

        if (def.alarma && estado === "pendiente" && !alarmaPuesta) {
          ejecutarEn = horaDeLaAlarma(REF);
          alarmaPuesta = true;
        }

        await db.insert(tareaProgramada)
          .values({
            presupuestoId: fila.id,
            tipo,
            ejecutarEn,
            estado,
            asunto: ASUNTOS[tipo],
            texto,
            ejecutadaEn: estado === "enviada" ? ejecutarEn : null,
          })
          .run();

        if (estado === "enviada") {
          eventos.push({
            tipo: "seguimiento_enviado",
            meta: { numero: tipo === "seguimiento_1" ? 1 : tipo === "seguimiento_2" ? 2 : 3, tipo, texto },
            ts: ejecutarEn,
          });
          const cuantosDias = Math.floor((REF.getTime() - ejecutarEn.getTime()) / UN_DIA);
          if (cuantosDias <= 3) {
            avisos.push({
              texto: `📨 seguimiento ${tipo === "seguimiento_1" ? 1 : tipo === "seguimiento_2" ? 2 : 3} enviado a ${nombreCliente.split(" ")[0]} · ${formatoEurosCorto(importes.total)}`,
              ts: ejecutarEn,
            });
          }
        }
      }
    }

    if (firmadoEn) {
      eventos.push({
        tipo: "firmado",
        meta: { ip: def.firma!.ip, dispositivo: def.firma!.dispositivo, total: importes.total },
        ts: firmadoEn,
      });
      eventos.push({
        tipo: "cambio_estado",
        meta: { a: "ganado", porque: "el cliente ha firmado el presupuesto" },
        ts: new Date(firmadoEn.getTime() + 1000),
      });
      if (def.firma!.dias <= 3) {
        avisos.push({
          texto: `✅ ${nombreCliente.split(" ")[0]} ha aceptado y firmado el presupuesto de ${formatoEurosCorto(importes.total)} · obra ganada`,
          ts: firmadoEn,
        });
      }
    } else if (def.estado === "perdido" && cerradoEn) {
      eventos.push({
        tipo: "cambio_estado",
        meta: { a: "perdido", porque: def.motivo ?? "sin motivo" },
        ts: cerradoEn,
      });
    } else if (def.estado === "expirado" && cerradoEn) {
      eventos.push({
        tipo: "cambio_estado",
        meta: { a: "expirado", porque: "ha pasado la fecha de validez sin cerrarse" },
        ts: cerradoEn,
      });
    }

    for (const e of eventos.sort((a, b) => a.ts.getTime() - b.ts.getTime())) {
      await db.insert(evento)
        .values({ presupuestoId: fila.id, tipo: e.tipo, meta: JSON.stringify(e.meta), ts: e.ts })
        .run();
    }
    const ultimoAviso = avisos.at(-1);
    for (const a of avisos) {
      await db.insert(aviso)
        .values({
          presupuestoId: fila.id,
          texto: a.texto,
          leido: REF.getTime() - a.ts.getTime() > UN_DIA / 2,
          ts: a.ts,
        })
        .run();
    }
    if (ultimoAviso) {
      await db.update(presupuesto)
        .set({ ultimoAvisoEn: ultimoAviso.ts })
        .where(sql`${presupuesto.id} = ${fila.id}`)
        .run();
    }

    resumen.push({
      ref: def.ref,
      id: fila.id,
      estado: def.estado,
      total: importes.total,
      enviadoEn,
      cerradoEn,
      visitaEn,
      ajuste: notaAjuste,
    });
  }

  // 6 · Las solicitudes pendientes de convertir.
  for (const s of SOLICITUDES) {
    await db.insert(solicitud)
      .values({
        clienteNombre: s.clienteNombre,
        telefono: s.telefono,
        email: s.email,
        direccion: s.direccion,
        titulo: s.titulo,
        urgencia: s.urgencia,
        textoOriginal: s.textoOriginal,
        conceptos: JSON.stringify(s.conceptos),
        origen: s.origen ?? "manolo",
        estado: "pendiente",
        presupuestoId: null,
        creadoEn: new Date(REF.getTime() - s.horas * UNA_HORA),
      })
      .run();
  }

  // 7 · Las plantillas.
  for (const p of PLANTILLAS) {
    const lineas = p.lineas.map(([codigo, medicion, marca]) => {
      const banco = partidas.get(codigo);
      if (!banco) throw new Error(`Plantilla ${p.nombre}: el código ${codigo} no está en el banco`);
      return {
        codigo,
        capitulo: banco.capitulo,
        descripcion: banco.nombre,
        unidad: banco.unidad,
        medicion,
        opcional: marca === "opcional",
      };
    });
    await db.insert(plantilla)
      .values({
        nombre: p.nombre,
        descripcion: p.descripcion,
        lineas: JSON.stringify(lineas),
        creadoEn: enDia(REF, 40, 9, 0),
      })
      .run();
  }

  return await comprobar(REF, fechaAlta, resumen);
}

/** La hora a la que el seed deja un seguimiento listo para salir hoy. */
function horaDeLaAlarma(ref: Date): Date {
  const alarma = process.env.DEMO_ALARMA?.trim();
  if (alarma && /^\d{1,2}:\d{2}$/.test(alarma)) {
    const [h, m] = alarma.split(":").map(Number);
    const hoy = enDia(ref, 0, h, m);
    if (hoy > ref) return hoy;
  }
  return new Date(ref.getTime() + 2 * UNA_HORA);
}

/** Un trazo de firma de ejemplo: una rúbrica dibujada a mano en el canvas. */
const FIRMA_PNG =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120" viewBox="0 0 320 120"><path d="M18 88c22-8 34-46 48-56 14-10 14 30 22 44 8 14 18-34 30-40 12-6 10 40 20 48 10 8 22-30 34-38 12-8 16 22 26 26 10 4 24-14 34-20" fill="none" stroke="#1B2537" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M132 96c34 6 82 4 120-6" fill="none" stroke="#1B2537" stroke-width="2" stroke-linecap="round"/></svg>`,
  ).toString("base64");

/* ------------------------------------------------------------ el cuadre */

type Resumen = {
  ref: string;
  id: number;
  estado: Estado;
  total: number;
  enviadoEn: Date | null;
  cerradoEn: Date | null;
  visitaEn: Date;
  ajuste?: string;
};

async function comprobar(REF: Date, fechaAlta: Date, resumen: Resumen[]) {
  const fallos: string[] = [];
  const exige = (etiqueta: string, real: number | string, esperado: number | string) => {
    if (real !== esperado) fallos.push(`${etiqueta}: ${real} (se esperaba ${esperado})`);
  };

  const porEstado = (estado: Estado) => resumen.filter((r) => r.estado === estado);
  const vivos = resumen.filter((r) => ["enviado", "visto", "en_conversacion"].includes(r.estado));
  const suma = (filas: Resumen[]) => filas.reduce((s, r) => s + r.total, 0);

  exige("presupuestos", resumen.length, 37);
  exige("borradores", porEstado("borrador").length, 2);
  exige("ganados", porEstado("ganado").length, 5);
  exige("perdidos", porEstado("perdido").length, 14);
  exige("expirados", porEstado("expirado").length, 4);
  exige("vivos", vivos.length, 12);
  exige("€ vivos", suma(vivos), 8_740_000);

  // Sin respuesta: vivos enviados hace 8 días o más, sin apertura ni respuesta
  // del cliente en los últimos 7 días.
  const hace7 = REF.getTime() - 7 * UN_DIA;
  const hace8 = REF.getTime() - 8 * UN_DIA;
  const señales = await Promise.all(
    vivos.map(async (r) => {
      const [ultima, respondio] = await Promise.all([
        db
          .select({ ts: sql<number>`max(${eventoLectura.ts})` })
          .from(eventoLectura)
          .where(sql`${eventoLectura.presupuestoId} = ${r.id}`)
          .get(),
        db
          .select({ ts: presupuesto.respondioEn })
          .from(presupuesto)
          .where(sql`${presupuesto.id} = ${r.id}`)
          .get(),
      ]);
      return { r, ultima: ultima?.ts ? Number(ultima.ts) : null, respondio: respondio?.ts ?? null };
    }),
  );
  const sinRespuesta = señales
    .filter(({ r, ultima, respondio }) => {
      if (!r.enviadoEn || r.enviadoEn.getTime() > hace8) return false;
      if (ultima && ultima > hace7) return false;
      if (respondio && respondio.getTime() > hace7) return false;
      return true;
    })
    .map(({ r }) => r);
  exige("sin respuesta > 7 días", sinRespuesta.length, 4);
  exige("€ sin respuesta", suma(sinRespuesta), 3_120_000);

  const hace30 = REF.getTime() - 30 * UN_DIA;
  const ganados30 = porEstado("ganado").filter((r) => r.cerradoEn && r.cerradoEn.getTime() >= hace30);
  exige("ganados en 30 días", ganados30.length, 3);
  exige("€ ganados en 30 días", suma(ganados30), 2_890_000);

  // Tasa de firma antes y después del alta.
  const cerrados = resumen.filter((r) => ["ganado", "perdido", "expirado"].includes(r.estado));
  const antes = cerrados.filter((r) => r.cerradoEn! < fechaAlta);
  const despues = cerrados.filter((r) => r.cerradoEn! >= fechaAlta);
  exige("cerrados antes del alta", antes.length, 6);
  exige("ganados antes del alta", antes.filter((r) => r.estado === "ganado").length, 1);
  exige("cerrados tras el alta", despues.length, 17);
  exige("ganados tras el alta", despues.filter((r) => r.estado === "ganado").length, 4);

  // Tiempo medio de la visita al envío, antes y después del alta.
  const enviados = resumen.filter((r) => r.enviadoEn);
  const dias = (r: Resumen) => Math.floor((r.enviadoEn!.getTime() - r.visitaEn.getTime()) / UN_DIA);
  const antesEnv = enviados.filter((r) => r.enviadoEn! < fechaAlta);
  const despuesEnv = enviados.filter((r) => r.enviadoEn! >= fechaAlta);
  const media = (filas: Resumen[]) => filas.reduce((s, r) => s + dias(r), 0) / filas.length;
  exige("enviados antes del alta", antesEnv.length, 6);
  exige("días visita→envío antes", Math.round(media(antesEnv)), 14);
  exige("enviados tras el alta", despuesEnv.length, 29);
  exige("días visita→envío después", Math.round(media(despuesEnv)), 1);

  // Lo que HOY tiene que enseñar.
  const inicioHoy = inicioDelDia(REF).getTime();
  const aperturasHoy = (
    await db
      .select({ n: sql<number>`count(*)` })
      .from(eventoLectura)
      .where(sql`${eventoLectura.seccion} is null and ${eventoLectura.ts} >= ${inicioHoy}`)
      .get()
  )?.n;
  exige("aperturas de hoy", Number(aperturasHoy ?? 0), 2);

  const salenHoy = (
    await db
      .select({ n: sql<number>`count(*)` })
      .from(tareaProgramada)
      .where(
        sql`${tareaProgramada.estado} = 'pendiente' and ${tareaProgramada.ejecutarEn} >= ${inicioHoy} and ${tareaProgramada.ejecutarEn} < ${inicioHoy + UN_DIA}`,
      )
      .get()
  )?.n;
  exige("seguimientos que salen hoy", Number(salenHoy ?? 0), 1);

  const validez = await Promise.all(
    vivos.map(async (r) => ({
      r,
      v: (await db.select({ v: presupuesto.validoHasta }).from(presupuesto).where(sql`${presupuesto.id} = ${r.id}`).get())?.v ?? null,
    })),
  );
  const caducanPronto = validez.filter(({ v }) => {
    if (!v) return false;
    const d = Math.floor((v.getTime() - REF.getTime()) / UN_DIA);
    return d >= 0 && d <= 3;
  });
  exige("caducan en 3 días o menos", caducanPronto.length, 2);

  const ultimasLecturas = await Promise.all(
    porEstado("expirado").map(async (r) => {
      const fila = await db
        .select({ ts: sql<number>`max(${eventoLectura.ts})` })
        .from(eventoLectura)
        .where(sql`${eventoLectura.presupuestoId} = ${r.id}`)
        .get();
      return fila?.ts ? Number(fila.ts) : null;
    }),
  );
  const reabiertos = ultimasLecturas.filter((ts) => !!ts && ts > REF.getTime() - 7 * UN_DIA);
  exige("expirados reabiertos", reabiertos.length, 1);

  return { fallos, resumen };
}
