// El formulario público de /solicitar: qué se pide y cómo se valida. Lo usan el
// navegador (para avisar al momento) y el servidor (que es quien manda), así que
// nunca validan cosas distintas. Seguro en el navegador: no toca la base.
import { z } from "zod";
import type { Urgencia } from "./tipos";

/** El tipo de obra decide el título de la solicitud en la bandeja. */
export const TIPOS_DE_OBRA = [
  { clave: "bano", etiqueta: "Baño", titulo: "Reforma de baño" },
  { clave: "cocina", etiqueta: "Cocina", titulo: "Reforma de cocina" },
  { clave: "piso", etiqueta: "Piso Completo", titulo: "Reforma integral de piso" },
  { clave: "pintura", etiqueta: "Pintura", titulo: "Pintura" },
  { clave: "otra", etiqueta: "Otra Obra", titulo: "Otra obra" },
] as const;

/** El plazo que marca el cliente es la urgencia de la solicitud. */
export const PLAZOS: { clave: Urgencia; etiqueta: string }[] = [
  { clave: "baja", etiqueta: "Sin Prisa" },
  { clave: "media", etiqueta: "En Unos Meses" },
  { clave: "alta", etiqueta: "Cuanto Antes" },
];

const CLAVES_OBRA = TIPOS_DE_OBRA.map((t) => t.clave) as [string, ...string[]];

export const SolicitudWeb = z.object({
  nombre: z.string().trim().min(3, "Escribe tu nombre y apellidos.").max(80, "El nombre es demasiado largo."),
  telefono: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s.-]{7,17}$/, "Escribe un teléfono de contacto válido."),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Ese email no parece válido."),
  direccion: z.string().trim().min(8, "Escribe la dirección de la obra.").max(160),
  obra: z.enum(CLAVES_OBRA, { error: "Elige qué obra es." }),
  plazo: z.enum(["baja", "media", "alta"], { error: "Dinos para cuándo la quieres." }),
  mensaje: z
    .string()
    .trim()
    .min(20, "Cuéntanos un poco más: con dos o tres frases nos basta.")
    .max(2000, "El mensaje es demasiado largo: resúmelo un poco."),
  consentimiento: z.literal(true, { error: "Necesitamos tu permiso para poder llamarte." }),
});

export type SolicitudWebDatos = z.infer<typeof SolicitudWeb>;

/** Los errores de validación, campo a campo, en castellano. */
export type ErroresSolicitud = Partial<Record<keyof SolicitudWebDatos, string>>;

export function validarSolicitud(
  crudo: Record<string, unknown>,
): { ok: true; datos: SolicitudWebDatos } | { ok: false; errores: ErroresSolicitud } {
  const r = SolicitudWeb.safeParse(crudo);
  if (r.success) return { ok: true, datos: r.data };
  const errores: ErroresSolicitud = {};
  for (const problema of r.error.issues) {
    const campo = problema.path[0] as keyof SolicitudWebDatos;
    errores[campo] ??= problema.message;
  }
  return { ok: false, errores };
}

export function tituloDeObra(clave: string): string {
  return TIPOS_DE_OBRA.find((t) => t.clave === clave)?.titulo ?? "Otra obra";
}
