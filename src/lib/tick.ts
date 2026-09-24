// El latido del producto. Sin procesos en segundo plano ni setInterval: tick()
// ejecuta las tareas vencidas y marca como Expirado lo que ha pasado su fecha.
// Lo llama el endpoint de polling en cada petición y el botón del reloj de demo.
// En producción lo llamaría un cron cada minuto; aquí, el propio panel.
//
// Tres cosas que este fichero se toma en serio:
//   · es BARATO: si no hay nada vencido son dos consultas por índice y ni una
//     escritura, porque lo llaman cada 3 segundos;
//   · es SEGURO a la vez desde varias peticiones: cada tarea se reclama con un
//     UPDATE condicionado al estado, antes de cualquier efecto externo, así que
//     un seguimiento no puede salir dos veces;
//   · no miente con las fechas: el tercer toque se recalcula con los días de
//     caducidad REALES en el momento de salir.
//
// DUEÑO: carril C.
import { and, asc, eq, inArray, isNotNull, lt, lte } from "drizzle-orm";
import { db, presupuesto, tareaProgramada } from "@/db";
import { notificar } from "./avisos";
import { presupuestoPorId } from "./consultas";
import { enviarEmail, hayEmail } from "./email";
import { cambiarEstado, cancelarTareas, registrarEvento } from "./eventos";
import { formatoEurosCorto } from "./formato";
import { ahora, cargarReloj } from "./reloj";
import { urlDeLaApp } from "./telegram";
import { diasEntre } from "./tiempo";
import { ESTADOS_VIVOS, type ResultadoTick, type TipoTarea } from "./tipos";

/** El número del toque tal y como se lee en el timeline y en los avisos. */
const NUMERO: Record<TipoTarea, number> = {
  seguimiento_1: 1,
  seguimiento_2: 2,
  cierre: 3,
};

const VIVOS: readonly string[] = ESTADOS_VIVOS;

/** «hoy mismo», «1 día», «9 días». Los días que de verdad quedan. */
function diasEnPalabras(dias: number): string {
  if (dias <= 0) return "hoy mismo";
  return dias === 1 ? "1 día" : `${dias} días`;
}

/** Como lo escribió quien redactó el texto en el momento de enviar. */
function diasComoSeEscribieron(dias: number): string {
  if (dias <= 0) return "menos de un día";
  return dias === 1 ? "1 día" : `${dias} días`;
}

function escaparRegExp(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Una cuenta de días pegada a una palabra de caducidad: «caduca en 3 días»,
// «expira mañana», «la validez termina en un día». Solo se toca eso.
const CUENTA_DE_CADUCIDAD =
  /(caduca|caducar|expira|expirar|vence|vencer|validez|válido|valido)([^.!?;]{0,60}?)(\b\d{1,3} d[ií]as?\b|\bun d[ií]a\b|\bmañana\b|\bhoy mismo\b|\bhoy\b)/giu;

/** «… en », «… dentro de » justo antes de la cuenta de días. */
const PREPOSICION = /\s(en|dentro de)\s*$/i;

/**
 * Ajusta el tercer toque a la verdad del día en que sale.
 *
 * El texto se redactó al enviar, con los días que faltaban entonces. Si el
 * reloj ha avanzado o la caducidad ha cambiado, la frase ya no vale: aquí se
 * cambia la cuenta de días por la real. Nunca puede decir «expira en 3 días»
 * cuando expira hoy.
 */
export function ajustarDiasDeCaducidad(
  texto: string,
  diasPrevistos: number,
  diasReales: number,
): string {
  const real = diasEnPalabras(diasReales);
  // Cuando ya no quedan días, «hoy mismo» es un adverbio: pide frase sin «en».
  const adverbio = diasReales <= 0;
  let salida = texto;

  // 1 · Toda cuenta de días pegada a una palabra de caducidad (venga del texto
  //     base de Ajustes o de la IA), solo si no coincide ya con la realidad.
  //     Se cuida la preposición: «caduca mañana» → «caduca en 4 días», pero
  //     «caduca en 1 día» → «caduca hoy mismo», nunca «caduca en hoy mismo».
  salida = salida.replace(CUENTA_DE_CADUCIDAD, (entero, verbo, medio, cuenta) => {
    if (String(cuenta).toLowerCase() === real.toLowerCase()) return entero;
    const conPreposicion = PREPOSICION.test(medio);
    let enlace: string = medio;
    if (adverbio && conPreposicion) enlace = medio.replace(PREPOSICION, " ");
    else if (!adverbio && !conPreposicion) enlace = `${medio.replace(/\s+$/, "")} en `;
    return `${verbo}${enlace}${real}`;
  });

  // 2 · Por si la frase que se coció al enviar quedó suelta, lejos de su verbo:
  //     se cambia la cuenta exacta, arrastrando su preposición si la lleva.
  const previsto = diasComoSeEscribieron(diasPrevistos);
  if (previsto !== real) {
    const cuenta = escaparRegExp(previsto);
    salida = adverbio
      ? salida.replace(new RegExp(`(\\s)(?:en|dentro de)\\s+${cuenta}\\b`, "giu"), `$1${real}`)
      : salida;
    salida = salida.replace(new RegExp(`\\b${cuenta}\\b`, "gu"), real);
  }

  return salida;
}

/* --------------------------------------------------------------- el latido */

export async function tick(): Promise<ResultadoTick> {
  await cargarReloj();
  const hoy = ahora();
  let expirados = 0;
  let tareas = 0;

  /* 1 · Lo que ha pasado su fecha de validez pasa a Expirado. cambiarEstado()
   *     ya cancela sus tareas pendientes, así que esto va PRIMERO: un
   *     presupuesto que caduca hoy no manda seguimientos hoy. */
  const caducados = await db
    .select({ id: presupuesto.id })
    .from(presupuesto)
    .where(
      and(
        inArray(presupuesto.estado, [...ESTADOS_VIVOS]),
        isNotNull(presupuesto.validoHasta),
        lt(presupuesto.validoHasta, hoy),
      ),
    )
    .all();

  for (const { id } of caducados) {
    if (!(await cambiarEstado(id, "expirado", "ha pasado la fecha de validez"))) continue;
    expirados++;
    const p = await presupuestoPorId(id);
    if (!p) continue;
    await notificar(
      id,
      `⌛ Ha caducado el presupuesto de ${p.clienteNombre} · ${formatoEurosCorto(p.total)} · ${p.titulo} · se han parado los seguimientos`,
    );
  }

  /* 2 · Las tareas vencidas. */
  const vencidas = await db
    .select()
    .from(tareaProgramada)
    .where(and(eq(tareaProgramada.estado, "pendiente"), lte(tareaProgramada.ejecutarEn, hoy)))
    .orderBy(asc(tareaProgramada.ejecutarEn))
    .all();

  for (const tarea of vencidas) {
    const p = await presupuestoPorId(tarea.presupuestoId);
    if (!p) continue;

    // Se paran solos: máximo tres toques, y ni uno si ya no hay a quién perseguir.
    if (!VIVOS.includes(p.estado)) {
      await cancelarTareas(p.id, "el presupuesto ya estaba cerrado");
      continue;
    }
    if (p.respondioEn) {
      await cancelarTareas(p.id, "el cliente ha respondido");
      continue;
    }

    // El tercer toque dice los días que quedan DE VERDAD hoy.
    let texto = tarea.texto;
    if (tarea.tipo === "cierre" && p.validoHasta) {
      texto = ajustarDiasDeCaducidad(
        texto,
        p.caducidadDias - 14,
        diasEntre(hoy, p.validoHasta),
      );
    }

    // Se reclama la tarea ANTES de avisar a nadie: si dos peticiones llegan a
    // la vez, solo una se la lleva.
    const reclamada = await db
      .update(tareaProgramada)
      .set({ estado: "enviada", ejecutadaEn: hoy, texto })
      .where(and(eq(tareaProgramada.id, tarea.id), eq(tareaProgramada.estado, "pendiente")))
      .run();
    if (reclamada.rowsAffected !== 1) continue;
    tareas++;

    const numero = NUMERO[tarea.tipo as TipoTarea] ?? 1;
    await registrarEvento(
      p.id,
      "seguimiento_enviado",
      { numero, tipo: tarea.tipo, asunto: tarea.asunto, texto },
      hoy,
    );

    const nombre = p.clienteNombre.split(" ")[0];
    await notificar(
      p.id,
      `📨 Seguimiento ${numero} enviado a ${nombre} · ${formatoEurosCorto(p.total)}`,
    );

    if (hayEmail()) {
      await enviarEmail(
        `${tarea.asunto} · ${p.clienteNombre} · ${formatoEurosCorto(p.total)}`,
        `${texto}\n\n— Presupuesto ${p.numero} · ${p.titulo} · ${p.direccionObra}\n${urlDeLaApp()}/p/${p.token}`,
      );
    }
  }

  return { tareas, expirados };
}
