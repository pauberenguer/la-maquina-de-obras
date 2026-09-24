// El timeline de Actividad habla en frases humanas, no en códigos. Aquí se
// convierte cada evento en la frase que lee Manolo.
//
// DUEÑO: carril C (la fase 5 añade las frases del tracking fino).
import type { Estado, Seccion, TipoEvento } from "./tipos";
import {
  formatoDispositivo,
  formatoDuracion,
  formatoEurosCorto,
  formatoFecha,
  formatoUbicacion,
  formatoVisita,
} from "./formato";

export type IconoFrase =
  | "creado"
  | "enviado"
  | "abierto"
  | "respuesta"
  | "seguimiento"
  | "cancelado"
  | "estado"
  | "firmado"
  | "aviso"
  | "pdf";

export type Frase = {
  icono: IconoFrase;
  /** La frase principal, en castellano de oficio. */
  texto: string;
  /** El detalle en gris debajo, si lo hay. */
  detalle?: string;
  /** Tono del icono, para que Ganado y Perdido salten a la vista. */
  tono?: "normal" | "bueno" | "malo" | "aviso";
};

const ETIQUETA_ESTADO: Record<Estado, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  visto: "Visto",
  en_conversacion: "En conversación",
  ganado: "Ganado",
  perdido: "Perdido",
  expirado: "Expirado",
};

const ETIQUETA_SECCION: Record<Seccion, string> = {
  cabecera: "la cabecera",
  capitulos: "las partidas",
  opcionales: "los opcionales",
  total: "el total",
  condiciones: "las condiciones",
  firma: "la firma",
};

type Meta = Record<string, unknown>;

const texto = (m: Meta, clave: string) => (typeof m[clave] === "string" ? (m[clave] as string) : null);
const numero = (m: Meta, clave: string) => (typeof m[clave] === "number" ? (m[clave] as number) : null);

/** Convierte un evento del timeline en la frase que se lee en pantalla. */
export function fraseDeEvento(tipo: string, metaJson: string): Frase {
  let meta: Meta = {};
  try {
    meta = JSON.parse(metaJson) as Meta;
  } catch {
    meta = {};
  }

  switch (tipo as TipoEvento) {
    case "creado":
      return { icono: "creado", texto: "Presupuesto creado a partir de la visita" };

    case "enviado": {
      const total = numero(meta, "total");
      const valido = meta.validoHasta ? formatoFecha(new Date(meta.validoHasta as string | number)) : null;
      return {
        icono: "enviado",
        texto: `Enviado al cliente${total ? ` · ${formatoEurosCorto(total)}` : ""}`,
        detalle: valido ? `válido hasta el ${valido}` : undefined,
      };
    }

    case "abierto": {
      const visitaN = numero(meta, "visitaN") ?? 1;
      const ciudad = formatoUbicacion(texto(meta, "ciudad"), texto(meta, "pais"));
      const dispositivo = formatoDispositivo(texto(meta, "dispositivo"));
      const segundos = numero(meta, "segundos");
      const secciones = Array.isArray(meta.secciones) ? (meta.secciones as [Seccion, number][]) : [];
      const detalle = secciones.length
        ? secciones
            .map(([s, d]) => `${ETIQUETA_SECCION[s] ?? s}: ${formatoDuracion(d)}`)
            .join(" · ")
        : segundos
          ? `${formatoDuracion(segundos)} en la página`
          : undefined;
      return {
        icono: "abierto",
        tono: meta.expirado ? "aviso" : "normal",
        texto: meta.expirado
          ? `El cliente ha vuelto a abrir el presupuesto caducado · ${formatoVisita(visitaN)} · ${dispositivo} · ${ciudad}`
          : `El cliente ha abierto el presupuesto · ${formatoVisita(visitaN)} · ${dispositivo} · ${ciudad}`,
        detalle,
      };
    }

    case "seccion_leida": {
      const seccion = texto(meta, "seccion") as Seccion | null;
      const duracion = numero(meta, "duracionS");
      return {
        icono: "abierto",
        texto: `Ha leído ${seccion ? ETIQUETA_SECCION[seccion] ?? seccion : "una sección"}`,
        detalle: duracion ? formatoDuracion(duracion) : undefined,
      };
    }

    case "respuesta_cliente":
      return {
        icono: "respuesta",
        tono: "aviso",
        texto: "El cliente ha escrito",
        detalle: texto(meta, "texto") ?? undefined,
      };

    case "seguimiento_enviado": {
      const n = numero(meta, "numero") ?? 1;
      return {
        icono: "seguimiento",
        texto: n === 3 ? "Seguimiento 3 enviado (aviso de caducidad)" : `Seguimiento ${n} enviado`,
        detalle: texto(meta, "texto") ?? undefined,
      };
    }

    case "seguimiento_cancelado":
      return {
        icono: "cancelado",
        texto: "Seguimientos pausados",
        detalle: texto(meta, "porque") ?? undefined,
      };

    case "cambio_estado": {
      const a = texto(meta, "a") as Estado | null;
      const etiqueta = a ? (ETIQUETA_ESTADO[a] ?? a) : "otro estado";
      return {
        icono: "estado",
        tono: a === "ganado" ? "bueno" : a === "perdido" || a === "expirado" ? "malo" : "normal",
        texto: `Pasa a ${etiqueta}`,
        detalle: texto(meta, "porque") ?? undefined,
      };
    }

    case "firmado": {
      const total = numero(meta, "total");
      return {
        icono: "firmado",
        tono: "bueno",
        texto: `El cliente ha firmado${total ? ` · ${formatoEurosCorto(total)}` : ""}`,
        detalle: [texto(meta, "dispositivo") ? formatoDispositivo(texto(meta, "dispositivo")) : null, texto(meta, "ip")]
          .filter(Boolean)
          .join(" · "),
      };
    }

    case "aviso_enviado":
      return { icono: "aviso", texto: texto(meta, "texto") ?? "Aviso enviado" };

    case "opcional_marcado":
      return {
        icono: "abierto",
        texto: `El cliente ha ${meta.elegida ? "marcado" : "quitado"} un opcional`,
        detalle: texto(meta, "descripcion") ?? undefined,
      };

    case "pdf_descargado":
      return { icono: "pdf", texto: "El cliente se ha descargado el PDF" };

    default:
      return { icono: "creado", texto: tipo.replaceAll("_", " ") };
  }
}
