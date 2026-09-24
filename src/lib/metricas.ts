// LOS NÚMEROS del panel. Son sumas de presupuestos reales, nunca estimaciones,
// y cada uno enseña su fórmula.
import { and, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db, presupuesto } from "@/db";
import { elNegocio, sinRespuesta } from "./consultas";
import { formatoEurosCorto, formatoPorcentaje } from "./formato";
import { ahora, cargarReloj, UN_DIA } from "./reloj";
import { ESTADOS_CERRADOS, ESTADOS_VIVOS } from "./tipos";

export type Metrica = {
  clave: string;
  etiqueta: string;
  /** Ya formateado para la pantalla. */
  valor: string;
  /** El texto pequeño en gris debajo de la cifra. */
  formula: string;
  /** Comparación con el «antes del sistema», cuando la métrica la tiene. */
  antes?: { etiqueta: string; valor: string };
  mejora?: "sube" | "baja" | null;
};

function suma(columna = presupuesto.total) {
  return sql<number>`coalesce(sum(${columna}), 0)`;
}

/** € en presupuestos vivos. */
export async function eurosVivos(): Promise<{ total: number; cuantos: number }> {
  const fila = await db
    .select({ total: suma(), n: sql<number>`count(*)` })
    .from(presupuesto)
    .where(inArray(presupuesto.estado, [...ESTADOS_VIVOS]))
    .get();
  return { total: Number(fila?.total ?? 0), cuantos: Number(fila?.n ?? 0) };
}

/** € parados: vivos sin señales del cliente desde hace más de 7 días. */
export async function eurosSinRespuesta(): Promise<{ total: number; cuantos: number }> {
  const filas = await sinRespuesta();
  return { total: filas.reduce((s, p) => s + p.total, 0), cuantos: filas.length };
}

/** € ganados en los últimos 30 días. */
export async function ganadoUltimos30(): Promise<{ total: number; cuantos: number }> {
  await cargarReloj();
  const desde = new Date(ahora().getTime() - 30 * UN_DIA);
  const fila = await db
    .select({ total: suma(), n: sql<number>`count(*)` })
    .from(presupuesto)
    .where(and(eq(presupuesto.estado, "ganado"), gte(presupuesto.cerradoEn, desde)))
    .get();
  return { total: Number(fila?.total ?? 0), cuantos: Number(fila?.n ?? 0) };
}

export type Tasa = { ganados: number; cerrados: number; pct: number };

/** Tasa de firma: ganados entre cerrados, antes y después de que Manolo usara el sistema. */
export async function tasaDeFirma(): Promise<{ antes: Tasa; despues: Tasa }> {
  const alta = (await elNegocio()).fechaAlta;
  const cuenta = async (antesDelAlta: boolean): Promise<Tasa> => {
    const fila = await db
      .select({
        cerrados: sql<number>`count(*)`,
        ganados: sql<number>`sum(case when ${presupuesto.estado} = 'ganado' then 1 else 0 end)`,
      })
      .from(presupuesto)
      .where(
        and(
          inArray(presupuesto.estado, [...ESTADOS_CERRADOS]),
          isNotNull(presupuesto.cerradoEn),
          antesDelAlta ? lt(presupuesto.cerradoEn, alta) : gte(presupuesto.cerradoEn, alta),
        ),
      )
      .get();
    const cerrados = Number(fila?.cerrados ?? 0);
    const ganados = Number(fila?.ganados ?? 0);
    return { ganados, cerrados, pct: cerrados ? (ganados / cerrados) * 100 : 0 };
  };
  const [antes, despues] = await Promise.all([cuenta(true), cuenta(false)]);
  return { antes, despues };
}

export type Tiempo = { dias: number; cuantos: number };

/** Días medios de la visita al envío, antes y después del sistema. */
export async function tiempoVisitaEnvio(): Promise<{ antes: Tiempo; despues: Tiempo }> {
  const alta = (await elNegocio()).fechaAlta;
  const cuenta = async (antesDelAlta: boolean): Promise<Tiempo> => {
    const fila = await db
      .select({
        n: sql<number>`count(*)`,
        // Días completos, como los contaría cualquiera: «tardó 1 día».
        // El 86400000 va literal para que SQLite haga división entera.
        dias: sql<number>`coalesce(avg(cast((${presupuesto.enviadoEn} - ${presupuesto.visitaEn}) / 86400000 as integer)), 0)`,
      })
      .from(presupuesto)
      .where(
        and(
          isNotNull(presupuesto.enviadoEn),
          antesDelAlta ? lt(presupuesto.enviadoEn, alta) : gte(presupuesto.enviadoEn, alta),
        ),
      )
      .get();
    return { dias: Number(fila?.dias ?? 0), cuantos: Number(fila?.n ?? 0) };
  };
  const [antes, despues] = await Promise.all([cuenta(true), cuenta(false)]);
  return { antes, despues };
}

/** Todo LOS NÚMEROS de una vez, ya formateado, cada uno con su fórmula. */
export async function losNumeros(): Promise<Metrica[]> {
  const [vivos, parados, ganado, firma, tiempo] = await Promise.all([
    eurosVivos(),
    eurosSinRespuesta(),
    ganadoUltimos30(),
    tasaDeFirma(),
    tiempoVisitaEnvio(),
  ]);
  const dias = (n: number) => (n === 1 ? "1 día" : `${Math.round(n * 10) / 10} días`.replace(".", ","));

  return [
    {
      clave: "vivos",
      etiqueta: "En presupuestos vivos",
      valor: formatoEurosCorto(vivos.total),
      formula: `suma del total con IVA de los ${vivos.cuantos} presupuestos en Enviado, Visto y En conversación`,
    },
    {
      clave: "parados",
      etiqueta: "Sin respuesta más de 7 días",
      valor: formatoEurosCorto(parados.total),
      formula: `${parados.cuantos} presupuestos vivos enviados hace 8 días o más sin ninguna apertura ni respuesta en los últimos 7`,
    },
    {
      clave: "ganado30",
      etiqueta: "Ganado en los últimos 30 días",
      valor: formatoEurosCorto(ganado.total),
      formula: `suma de los ${ganado.cuantos} presupuestos que pasaron a Ganado en los últimos 30 días`,
    },
    {
      clave: "firma",
      etiqueta: "Tasa de firma",
      valor: formatoPorcentaje(firma.despues.pct, 0),
      formula: `${firma.despues.ganados} ganados de ${firma.despues.cerrados} cerrados desde que usas la máquina`,
      antes: {
        etiqueta: "antes",
        valor: `${formatoPorcentaje(firma.antes.pct, 0)} · ${firma.antes.ganados} de ${firma.antes.cerrados}`,
      },
      mejora: firma.despues.pct >= firma.antes.pct ? "sube" : "baja",
    },
    {
      clave: "tiempo",
      etiqueta: "De la visita al envío",
      valor: dias(tiempo.despues.dias),
      formula: `media de los ${tiempo.despues.cuantos} presupuestos enviados desde que usas la máquina`,
      antes: {
        etiqueta: "antes",
        valor: `${dias(tiempo.antes.dias)} · ${tiempo.antes.cuantos} presupuestos`,
      },
      mejora: tiempo.despues.dias <= tiempo.antes.dias ? "sube" : "baja",
    },
  ];
}
