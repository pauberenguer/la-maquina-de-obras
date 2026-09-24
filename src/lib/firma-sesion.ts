// La cookie de sesión del panel: una caducidad firmada con HMAC-SHA256.
//
// Criptografía pura: sin base de datos ni cabeceras, para que la puedan usar
// igual src/proxy.ts (que no debe tocar la base) y las Server Actions.
import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_SESION = "mo_sesion";
/** Treinta días. */
export const DURACION_SESION_MS = 30 * 24 * 60 * 60 * 1000;

const VERSION = "v1";

/** El secreto que firma la cookie, o null si no está (o es demasiado corto). */
export function secretoDeSesion(): string | null {
  const secreto = process.env.PANEL_SECRET;
  return secreto && secreto.length >= 32 ? secreto : null;
}

function firma(contenido: string, secreto: string): string {
  return createHmac("sha256", secreto).update(contenido).digest("base64url");
}

/** El valor de la cookie para una sesión que caduca en `expiraEn` (ms, hora real). */
export function firmarSesion(expiraEn: number, secreto: string): string {
  const contenido = `${VERSION}.${expiraEn}`;
  return `${contenido}.${firma(contenido, secreto)}`;
}

/** ¿Es una cookie firmada por nosotros y todavía vigente? */
export function sesionVigente(valor: string | undefined, ahoraMs: number): boolean {
  const secreto = secretoDeSesion();
  if (!valor || !secreto) return false;
  const partes = valor.split(".");
  if (partes.length !== 3 || partes[0] !== VERSION) return false;

  const [version, expira, recibida] = partes;
  const esperada = firma(`${version}.${expira}`, secreto);
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const expiraEn = Number(expira);
  return Number.isFinite(expiraEn) && expiraEn > ahoraMs;
}

/** Compara dos textos en tiempo constante (para la contraseña). */
export function igualesEnTiempoConstante(a: string, b: string): boolean {
  const ha = createHmac("sha256", "comparar").update(a).digest();
  const hb = createHmac("sha256", "comparar").update(b).digest();
  return timingSafeEqual(ha, hb);
}
