// Lo que comparten los endpoints de la página del cliente.
//
// Dos reglas de este carril: todo se valida por TOKEN (nunca por id), y de la
// petición solo se saca lo que el producto necesita para el timeline: la IP, la
// ciudad si el túnel la manda, y el tipo de dispositivo.
//
// DUEÑO: carril B2.
import { headers } from "next/headers";
import { presupuestoPorToken, type PresupuestoConCliente } from "@/lib/consultas";
import { ipDe } from "@/lib/red";
import { ahora, cargarReloj } from "@/lib/reloj";
import type { Dispositivo } from "@/lib/tipos";

export type DatosDeLaPeticion = {
  ip: string | null;
  ciudad: string | null;
  pais: string | null;
  dispositivo: Dispositivo;
};

/** «móvil», «tablet» u «ordenador» a partir del user agent. */
export function dispositivoDeUserAgent(ua: string | null): Dispositivo {
  if (!ua) return "ordenador";
  const u = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk|kindle|android(?!.*mobi)/.test(u)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobi|windows phone|blackberry/.test(u)) return "movil";
  return "ordenador";
}

/**
 * Ciudad y país solo si los manda el túnel de Cloudflare. Sin túnel se quedan
 * en null y la interfaz dice «ubicación desconocida»: el día que APP_URL sea un
 * dominio público, esto empieza a llenarse sin tocar una línea.
 */
export async function datosDeLaPeticion(): Promise<DatosDeLaPeticion> {
  const h = await headers();
  return {
    ip: ipDe(h),
    ciudad: h.get("cf-ipcity")?.trim() || null,
    pais: h.get("cf-ipcountry")?.trim() || null,
    dispositivo: dispositivoDeUserAgent(h.get("user-agent")),
  };
}

/**
 * El presupuesto de un token, o null. Un borrador todavía no tiene página.
 * Deja cargado el reloj: todo endpoint público empieza por aquí.
 */
export async function presupuestoPublico(token: unknown): Promise<PresupuestoConCliente | null> {
  if (typeof token !== "string" || token.length === 0) return null;
  const [p] = await Promise.all([presupuestoPorToken(token), cargarReloj()]);
  if (!p || p.estado === "borrador") return null;
  return p;
}

/** ¿Ha pasado la fecha de validez? */
export function estaCaducado(p: PresupuestoConCliente): boolean {
  return p.validoHasta ? p.validoHasta.getTime() < ahora().getTime() : false;
}

/**
 * ¿Puede el cliente tocar todavía este presupuesto (marcar opcionales, firmar)?
 * No si ha caducado y no si ya está cerrado.
 */
export function estaAbierto(p: PresupuestoConCliente): boolean {
  if (p.estado === "ganado" || p.estado === "perdido" || p.estado === "expirado") return false;
  return !estaCaducado(p);
}

// Una respuesta nueva cada vez: el cuerpo de una Response solo se puede leer
// una vez, así que no se puede reutilizar entre peticiones.
export function noEncontrado(): Response {
  return Response.json({ error: "Este enlace no es válido o ya no está disponible." }, { status: 404 });
}

export function cerrado(): Response {
  return Response.json({ error: "Este presupuesto ya no admite cambios." }, { status: 409 });
}

/** Lee el cuerpo JSON sin tumbar la petición si viene mal. */
export async function cuerpo(req: Request): Promise<Record<string, unknown>> {
  try {
    const datos = await req.json();
    return datos && typeof datos === "object" ? (datos as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
