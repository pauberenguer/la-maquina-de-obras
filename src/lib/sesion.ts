// El acceso al panel: una sola contraseña (PANEL_PASSWORD) y una cookie firmada.
//
// Dos capas, a propósito:
//   · src/proxy.ts corta en la puerta todo /panel/* sin cookie válida;
//   · exigirSesion() se llama dentro de CADA Server Action del panel, porque una
//     acción se puede invocar desde cualquier ruta y el proxy no la ve.
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_SESION,
  DURACION_SESION_MS,
  firmarSesion,
  igualesEnTiempoConstante,
  secretoDeSesion,
  sesionVigente,
} from "./firma-sesion";
import { horaReal } from "./hora-real";
import { apuntarPeticion, esperaPendiente, olvidarFallos } from "./limites";
import { ipDe } from "./red";

/** ¿Está el acceso configurado? Sin contraseña o sin secreto, el panel no abre. */
export function accesoConfigurado(): boolean {
  return Boolean(process.env.PANEL_PASSWORD && secretoDeSesion());
}

/** ¿Trae esta petición una sesión válida? */
export async function haySesion(): Promise<boolean> {
  const valor = (await cookies()).get(COOKIE_SESION)?.value;
  return sesionVigente(valor, horaReal());
}

/**
 * La primera línea de toda Server Action del panel. Sin sesión, a /entrar: la
 * acción no llega a tocar nada.
 */
export async function exigirSesion(): Promise<void> {
  if (!(await haySesion())) redirect("/entrar");
}

export type ResultadoEntrar = { ok: true } | { ok: false; mensaje: string };

/** Comprueba la contraseña, con límite de intentos por IP, y abre la sesión. */
export async function entrarConContrasena(contrasena: string): Promise<ResultadoEntrar> {
  const esperada = process.env.PANEL_PASSWORD;
  const secreto = secretoDeSesion();
  if (!esperada || !secreto) {
    return {
      ok: false,
      mensaje: "El acceso no está configurado: faltan PANEL_PASSWORD o PANEL_SECRET en las variables de entorno.",
    };
  }

  const ip = ipDe(await headers());
  const espera = await esperaPendiente(ip, "entrar");
  if (espera > 0) {
    return {
      ok: false,
      mensaje: `Demasiados intentos fallidos. Vuelve a probar dentro de ${espera} ${espera === 1 ? "minuto" : "minutos"}.`,
    };
  }

  if (!igualesEnTiempoConstante(contrasena, esperada)) {
    await apuntarPeticion(ip, "entrar");
    return { ok: false, mensaje: "La contraseña no es correcta." };
  }

  await olvidarFallos(ip, "entrar");
  const expiraEn = horaReal() + DURACION_SESION_MS;
  (await cookies()).set(COOKIE_SESION, firmarSesion(expiraEn, secreto), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(DURACION_SESION_MS / 1000),
  });
  return { ok: true };
}

/** Cierra la sesión. */
export async function salir(): Promise<void> {
  (await cookies()).delete(COOKIE_SESION);
}
