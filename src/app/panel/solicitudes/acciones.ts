"use server";
// Las acciones de la bandeja de entrada: leer y guardar una visita, convertirla
// en presupuesto, descartarla y recuperarla.
//
// OJO: todo lo que se exporta de un fichero "use server" es una Server Action
// que se puede invocar desde fuera. Por eso aquí solo hay envoltorios, cada uno
// empieza comprobando la sesión, y el trabajo de verdad vive en
// src/lib/solicitudes.ts.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { extraerVisita, hayIa, SinClaveDeIa } from "@/lib/ia";
import { exigirSesion } from "@/lib/sesion";
import { convertirEnPresupuesto, descartar, guardarSolicitud, recuperar } from "@/lib/solicitudes";
import type { ConceptoCrudo, Urgencia } from "@/lib/tipos";

export type ResultadoVisita = { ok: true; solicitudId: number } | { ok: false; mensaje: string };

/* ------------------------------------------------------- leer la visita */

export type VisitaLeida = {
  clienteNombre: string;
  telefono: string;
  email: string;
  direccion: string;
  titulo: string;
  urgencia: Urgencia;
  conceptos: ConceptoCrudo[];
};

export type ResultadoLectura = { ok: true; visita: VisitaLeida } | { ok: false; mensaje: string };

/** Paso 1 · La IA lee el texto dictado o pegado. No guarda nada todavía. */
export async function leerLaVisita(texto: string): Promise<ResultadoLectura> {
  await exigirSesion();
  if (!texto.trim()) {
    return { ok: false, mensaje: "No hay nada que leer: dicta la visita o pega tus notas." };
  }
  if (!hayIa()) {
    return { ok: false, mensaje: new SinClaveDeIa().message };
  }
  try {
    const visita = await extraerVisita(texto);
    return {
      ok: true,
      visita: {
        clienteNombre: visita.clienteNombre ?? "",
        telefono: visita.telefono ?? "",
        email: visita.email ?? "",
        direccion: visita.direccion ?? "",
        titulo: visita.titulo,
        urgencia: visita.urgencia,
        conceptos: visita.conceptos,
      },
    };
  } catch (e) {
    console.error("No se ha podido leer la visita:", e);
    return { ok: false, mensaje: (e as Error).message };
  }
}

/* --------------------------------------------------- guardar la solicitud */

export type VisitaParaGuardar = VisitaLeida & { textoOriginal: string };

/** Paso 2 · La visita revisada por Manolo cae en la bandeja. */
export async function guardarVisita(visita: VisitaParaGuardar): Promise<ResultadoVisita> {
  await exigirSesion();
  const clienteNombre = visita.clienteNombre.trim();
  if (!clienteNombre) return { ok: false, mensaje: "Ponle un nombre al cliente antes de guardar." };

  const direccion = visita.direccion.trim();
  if (!direccion) return { ok: false, mensaje: "Falta la dirección de la obra." };

  const conceptos = visita.conceptos.filter((c) => c.descripcion.trim());
  if (conceptos.length === 0) {
    return { ok: false, mensaje: "La visita no tiene ni un concepto: no hay nada que presupuestar." };
  }

  const solicitudId = await guardarSolicitud({
    clienteNombre,
    telefono: visita.telefono,
    email: visita.email,
    direccion,
    titulo: visita.titulo,
    urgencia: visita.urgencia,
    textoOriginal: visita.textoOriginal,
    conceptos,
    origen: "manolo",
  });

  revalidatePath("/", "layout");
  return { ok: true, solicitudId };
}

/* ------------------------------------------------------------- convertir */

/**
 * «Convertir en Presupuesto»: crea el Borrador y, si sale bien, abre su ficha.
 */
export async function convertirSolicitud(
  solicitudId: number,
): Promise<{ ok: false; mensaje: string } | void> {
  await exigirSesion();
  const resultado = await convertirEnPresupuesto(solicitudId);
  if (!resultado.ok) return resultado;
  revalidatePath("/", "layout");
  redirect(`/panel/presupuestos/${resultado.presupuestoId}`);
}

/* -------------------------------------------------------------- descartar */

export async function descartarSolicitud(solicitudId: number): Promise<void> {
  await exigirSesion();
  await descartar(solicitudId);
  revalidatePath("/", "layout");
}

/** Deshacer un descarte: vuelve a la bandeja. */
export async function recuperarSolicitud(solicitudId: number): Promise<void> {
  await exigirSesion();
  await recuperar(solicitudId);
  revalidatePath("/", "layout");
}
