"use server";
// La única acción pública del producto: una solicitud desde la web.
//
// Está abierta a internet, así que se defiende sola: un campo trampa que solo
// rellenan los bots, la validación en el servidor (la misma regla que en el
// navegador) y un límite por IP de una solicitud por minuto y cinco por hora.
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { notificar } from "@/lib/avisos";
import { apuntarPeticion, esperaPendiente } from "@/lib/limites";
import { ipDe } from "@/lib/red";
import { urlDeLaApp } from "@/lib/telegram";
import { guardarSolicitudDeLaWeb } from "@/lib/solicitudes";
import { tituloDeObra, validarSolicitud, type ErroresSolicitud } from "@/lib/solicitud-web";

export type ResultadoSolicitud =
  | { ok: true; nombre: string }
  | { ok: false; errores?: ErroresSolicitud; mensaje?: string };

export async function enviarSolicitud(crudo: Record<string, unknown>): Promise<ResultadoSolicitud> {
  // El campo trampa: una persona no lo ve ni lo rellena. A un bot se le dice
  // que todo ha ido bien y no se guarda nada.
  if (typeof crudo.empresa === "string" && crudo.empresa.trim() !== "") {
    return { ok: true, nombre: "" };
  }

  const validada = validarSolicitud(crudo);
  if (!validada.ok) return { ok: false, errores: validada.errores };
  const datos = validada.datos;

  const ip = ipDe(await headers());
  const espera = await esperaPendiente(ip, "solicitar");
  if (espera > 0) {
    return {
      ok: false,
      mensaje: `Acabamos de recibir una solicitud desde esta conexión. Si quieres enviar otra, espera ${espera} ${espera === 1 ? "minuto" : "minutos"} o llámanos.`,
    };
  }
  await apuntarPeticion(ip, "solicitar");

  await guardarSolicitudDeLaWeb(datos);
  await notificar(
    null,
    `🔔 Nueva solicitud desde la web · ${datos.nombre} · ${tituloDeObra(datos.obra)} · ${datos.direccion} · sin visita: llámale para ir a verla`,
    `${urlDeLaApp()}/panel/solicitudes`,
  );

  revalidatePath("/panel", "layout");
  return { ok: true, nombre: datos.nombre.split(" ")[0] };
}
