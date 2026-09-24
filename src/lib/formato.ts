// Todos los formatos de la interfaz, en es-ES y Europe/Madrid.
// Nadie formatea importes ni fechas por su cuenta.
import { diasEntre, UN_DIA, UN_MINUTO, UNA_HORA } from "./tiempo";
import type { Unidad } from "./tipos";

const ZONA = "Europe/Madrid";

// `useGrouping: "always"` para que 8.200 € no salga como «8200 €»: en es-ES el
// separador de miles se omite por defecto en los números de cuatro cifras.
const euros = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: "always",
});
const eurosEnteros = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: "always",
});

/** 1.430.050 céntimos → «14.300,50 €». */
export function formatoEuros(centimos: number): string {
  return euros.format(centimos / 100);
}

/** Para titulares y avisos: «14.300 €». Redondea al euro. */
export function formatoEurosCorto(centimos: number): string {
  return eurosEnteros.format(Math.round(centimos / 100));
}

/** «14.300,50» sin el símbolo, para celdas con el euro en la cabecera. */
export function formatoNumeroEuros(centimos: number): string {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: "always",
  }).format(centimos / 100);
}

const decimales = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Mediciones: «22,5», «1», «13,75». */
export function formatoMedicion(valor: number): string {
  return decimales.format(valor);
}

export function formatoPorcentaje(valor: number, dec = 0): string {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(valor) + " %";
}

const ETIQUETA_UNIDAD: Record<Unidad, string> = {
  ud: "ud",
  m2: "m²",
  ml: "ml",
  m3: "m³",
  h: "h",
  pa: "pa",
};

/** «m2» → «m²». */
export function formatoUnidad(unidad: string): string {
  return ETIQUETA_UNIDAD[unidad as Unidad] ?? unidad;
}

const fechaCorta = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA,
  day: "numeric",
  month: "long",
  year: "numeric",
});
const fechaNumerica = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const horaCorta = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const diaYMes = new Intl.DateTimeFormat("es-ES", { timeZone: ZONA, day: "numeric", month: "short" });

/** «14 de marzo de 2026». */
export function formatoFecha(fecha: Date | number | null | undefined): string {
  if (fecha == null) return "—";
  return fechaCorta.format(fecha);
}

/** «14/03/2026». */
export function formatoFechaNumerica(fecha: Date | number | null | undefined): string {
  if (fecha == null) return "—";
  return fechaNumerica.format(fecha);
}

/** «14:35». */
export function formatoHora(fecha: Date | number | null | undefined): string {
  if (fecha == null) return "—";
  return horaCorta.format(fecha);
}

/** «14 mar · 14:35». */
export function formatoFechaHora(fecha: Date | number | null | undefined): string {
  if (fecha == null) return "—";
  return `${diaYMes.format(fecha).replace(".", "")} · ${horaCorta.format(fecha)}`;
}

/**
 * «hace 3 días», «hace 20 minutos», «dentro de 2 horas».
 * `referencia` es siempre la hora de la aplicación: quien llama la pide con ahora().
 */
export function formatoRelativo(
  fecha: Date | number | null | undefined,
  referencia: Date,
): string {
  if (fecha == null) return "—";
  const ms = (fecha instanceof Date ? fecha.getTime() : fecha) - referencia.getTime();
  const abs = Math.abs(ms);
  const rtf = new Intl.RelativeTimeFormat("es-ES", { numeric: "auto" });
  if (abs < UN_MINUTO) return "ahora mismo";
  if (abs < UNA_HORA) return rtf.format(Math.round(ms / UN_MINUTO), "minute");
  if (abs < UN_DIA) return rtf.format(Math.round(ms / UNA_HORA), "hour");
  return rtf.format(Math.round(ms / UN_DIA), "day");
}

/** «3 días», «1 día», «hoy». Para caducidades. */
export function formatoDiasRestantes(
  fecha: Date | number | null | undefined,
  referencia: Date,
): string {
  if (fecha == null) return "—";
  const dias = diasEntre(referencia, fecha);
  if (dias < 0) return "caducado";
  if (dias === 0) return "hoy";
  return dias === 1 ? "1 día" : `${dias} días`;
}

/** «2 min 30 s», «45 s». Para el tiempo por sección. */
export function formatoDuracion(segundos: number | null | undefined): string {
  if (segundos == null) return "—";
  if (segundos < 60) return `${Math.round(segundos)} s`;
  const min = Math.floor(segundos / 60);
  const resto = Math.round(segundos % 60);
  return resto ? `${min} min ${resto} s` : `${min} min`;
}

const ETIQUETA_DISPOSITIVO: Record<string, string> = {
  movil: "móvil",
  tablet: "tablet",
  ordenador: "ordenador",
};

export function formatoDispositivo(dispositivo: string | null | undefined): string {
  if (!dispositivo) return "dispositivo desconocido";
  return ETIQUETA_DISPOSITIVO[dispositivo] ?? dispositivo;
}

/** «2.ª visita». */
export function formatoVisita(n: number): string {
  return `${n}.ª visita`;
}

/** «Barcelona», «Sabadell» o «ubicación desconocida». */
export function formatoUbicacion(ciudad?: string | null, pais?: string | null): string {
  if (ciudad && pais && pais !== "ES") return `${ciudad} (${pais})`;
  if (ciudad) return ciudad;
  return "ubicación desconocida";
}

/**
 * Title Case de la interfaz: se capitalizan las palabras significativas y se
 * dejan en minúscula artículos, preposiciones y conjunciones que no abren el
 * título. Lo que ya viene en mayúsculas (IVA, CIF, la A de «16 A») se queda
 * como está.
 *
 * Se aplica al PINTAR nombres y títulos que vienen de la base —el título de la
 * obra, el nombre de una plantilla, el capítulo—, nunca al guardarlos: el dato
 * es el que escribió Manolo.
 */
const PALABRAS_MENORES = new Set([
  "a", "ante", "bajo", "con", "contra", "de", "desde", "del", "en", "entre", "hacia",
  "hasta", "para", "por", "según", "sin", "sobre", "tras", "y", "e", "o", "u", "ni",
  "que", "como", "el", "la", "los", "las", "un", "una", "unos", "unas", "al", "lo", "se",
]);

export function formatoTitulo(texto: string | null | undefined): string {
  if (!texto) return "";
  let abierta = true;
  return texto
    .split(" ")
    .map((palabra) => {
      const nucleo = palabra.replace(/[^\p{L}\p{N}]/gu, "");
      if (!nucleo) return palabra;
      const primera = abierta;
      abierta = false;
      // Lo que ya viene en mayúsculas es intencionado y no se toca: las siglas
      // (IVA, PDF) y las letras sueltas (la A de «16 A»).
      if (nucleo === nucleo.toUpperCase() && /\p{Lu}/u.test(nucleo)) return palabra;
      if (!primera && PALABRAS_MENORES.has(nucleo.toLowerCase())) return palabra.toLowerCase();
      const i = palabra.search(/\p{L}/u);
      if (i < 0) return palabra;
      return palabra.slice(0, i) + palabra[i]!.toUpperCase() + palabra.slice(i + 1);
    })
    .join(" ");
}
