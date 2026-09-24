// Los límites por IP de lo que es público y se puede abusar: el formulario de
// /solicitar y la contraseña de /entrar. Se cuentan en la tabla peticion_web y
// se miden con la hora REAL: adelantar el reloj de la demo no levanta un
// bloqueo.
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db, peticionWeb } from "@/db";
import { horaReal } from "./hora-real";

export type Motivo = "solicitar" | "entrar";

type Regla = { ventanaMs: number; maximo: number };

const MINUTO = 60_000;

/** Solicitudes: una por minuto y cinco por hora. Contraseña: cinco fallos en quince minutos. */
const REGLAS: Record<Motivo, Regla[]> = {
  solicitar: [
    { ventanaMs: MINUTO, maximo: 1 },
    { ventanaMs: 60 * MINUTO, maximo: 5 },
  ],
  entrar: [{ ventanaMs: 15 * MINUTO, maximo: 5 }],
};

/** Sin IP no se puede limitar por IP: se agrupan todas bajo una marca común. */
function clave(ip: string | null): string {
  return ip ?? "sin-ip";
}

/**
 * ¿Ha agotado esta IP su cupo? Devuelve los minutos que le quedan de espera, o
 * 0 si puede seguir.
 */
export async function esperaPendiente(ip: string | null, motivo: Motivo): Promise<number> {
  const ahora = horaReal();
  let espera = 0;
  for (const regla of REGLAS[motivo]) {
    const desde = new Date(ahora - regla.ventanaMs);
    const fila = await db
      .select({ n: sql<number>`count(*)`, primera: sql<number>`min(${peticionWeb.ts})` })
      .from(peticionWeb)
      .where(and(eq(peticionWeb.ip, clave(ip)), eq(peticionWeb.motivo, motivo), gte(peticionWeb.ts, desde)))
      .get();
    if (Number(fila?.n ?? 0) >= regla.maximo) {
      const libre = Number(fila?.primera ?? ahora) + regla.ventanaMs;
      espera = Math.max(espera, Math.ceil((libre - ahora) / MINUTO));
    }
  }
  return espera;
}

/** Apunta una petición que cuenta para el límite, y de paso barre lo de hace más de un día. */
export async function apuntarPeticion(ip: string | null, motivo: Motivo): Promise<void> {
  const ahora = horaReal();
  await db.insert(peticionWeb).values({ ip: clave(ip), motivo, ts: new Date(ahora) }).run();
  await db
    .delete(peticionWeb)
    .where(lt(peticionWeb.ts, new Date(ahora - 24 * 60 * MINUTO)))
    .run();
}

/** Tras entrar bien, los fallos anteriores de esa IP ya no cuentan. */
export async function olvidarFallos(ip: string | null, motivo: Motivo): Promise<void> {
  await db
    .delete(peticionWeb)
    .where(and(eq(peticionWeb.ip, clave(ip)), eq(peticionWeb.motivo, motivo)))
    .run();
}
