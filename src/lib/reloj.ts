// La hora de la aplicación. Es la hora real más el desplazamiento que guarda
// la tabla negocio, para que la demo pueda adelantar días sin tocar el sistema.
//
// Este es el ÚNICO fichero del producto donde se escribe new Date() o Date.now().
// Todo lo demás llama a ahora().
//
// La base es asíncrona y ahora() no: el desplazamiento vive en memoria y se
// carga con `await cargarReloj()` al empezar cada petición (página, layout,
// route handler, Server Action o script). Así ahora() se puede seguir usando
// dentro de un .map() o al formatear, sin contagiar de promesas medio producto.
import { eq } from "drizzle-orm";
import { db, negocio } from "@/db";
import { UNA_HORA, UN_DIA, UN_MINUTO } from "./tiempo";

export { UN_MINUTO, UNA_HORA, UN_DIA, masDias, diasEntre } from "./tiempo";

/** Cada cuánto se relee el desplazamiento como mucho. */
const VIGENCIA_MS = 1000;

let desfase: { valor: number; leidoEn: number } | null = null;
let lecturaEnCurso: Promise<void> | null = null;

async function leerDesfase(): Promise<void> {
  let valor = 0;
  try {
    const fila = await db.select({ v: negocio.relojOffsetMs }).from(negocio).limit(1).get();
    valor = fila?.v ?? 0;
  } catch {
    // Base todavía sin crear (durante el reset): la hora es la real.
    valor = 0;
  }
  desfase = { valor, leidoEn: Date.now() };
}

/**
 * Deja listo el desplazamiento para esta petición. Barato: si se leyó hace
 * menos de un segundo no toca la base, y si hay una lectura en marcha se espera
 * a esa en vez de lanzar otra.
 */
export async function cargarReloj(): Promise<void> {
  if (desfase && Date.now() - desfase.leidoEn < VIGENCIA_MS) return;
  lecturaEnCurso ??= leerDesfase().finally(() => {
    lecturaEnCurso = null;
  });
  await lecturaEnCurso;
}

/** El desplazamiento cargado, en milisegundos. */
export function desplazamiento(): number {
  if (desfase) return desfase.valor;
  // Nadie ha llamado a cargarReloj() en este proceso. En desarrollo es un error
  // que hay que ver; en producción se degrada a la hora real antes que romper.
  if (process.env.NODE_ENV !== "production") {
    throw new Error("ahora() antes de cargarReloj(): añade `await cargarReloj()` al empezar la petición.");
  }
  return 0;
}

/** La hora de la aplicación. */
export function ahora(): Date {
  return new Date(Date.now() + desplazamiento());
}

/** Los milisegundos de la hora de la aplicación. */
export function ahoraMs(): number {
  return Date.now() + desplazamiento();
}

/** Mueve el reloj de la demo. Devuelve el desplazamiento resultante. */
export async function moverReloj(ms: number): Promise<number> {
  const fila = await db.select({ v: negocio.relojOffsetMs }).from(negocio).limit(1).get();
  const nuevo = ms === 0 ? 0 : (fila?.v ?? 0) + ms;
  await db.update(negocio).set({ relojOffsetMs: nuevo }).where(eq(negocio.id, 1)).run();
  desfase = { valor: nuevo, leidoEn: Date.now() };
  return nuevo;
}

/** Descarta el desplazamiento cargado (tras un reset o un cambio directo). */
export function olvidarDesplazamiento() {
  desfase = null;
}

/** El inicio del día (00:00 en Europe/Madrid) al que pertenece el instante dado. */
export function inicioDelDia(fecha: Date = ahora()): Date {
  const partes = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  const parte = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  const desdeMedianoche =
    (parte("hour") % 24) * UNA_HORA + parte("minute") * UN_MINUTO + parte("second") * 1000;
  return new Date(fecha.getTime() - desdeMedianoche - (fecha.getTime() % 1000));
}

/** ¿Cae el instante dentro del día de hoy según el reloj de la aplicación? */
export function esHoy(fecha: Date | number | null | undefined): boolean {
  if (fecha == null) return false;
  const ms = fecha instanceof Date ? fecha.getTime() : fecha;
  const inicio = inicioDelDia().getTime();
  return ms >= inicio && ms < inicio + UN_DIA;
}
