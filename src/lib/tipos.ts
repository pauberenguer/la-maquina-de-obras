// Los contratos que unen los tres carriles. Aquí viven los tipos de dominio y
// las firmas de las funciones compartidas; el cuerpo de cada una está en su
// fichero (ia.ts, tick.ts, telegram.ts, avisos.ts…).
//
// Reglas: el dinero viaja SIEMPRE en céntimos enteros, y todo lo que toca la
// base es asíncrono (libSQL): se devuelve una promesa y se espera.

/* ---------------------------------------------------------------- dominio */

export const ESTADOS = [
  "borrador",
  "enviado",
  "visto",
  "en_conversacion",
  "ganado",
  "perdido",
  "expirado",
] as const;
export type Estado = (typeof ESTADOS)[number];

/** Estados en los que el presupuesto sigue vivo: su € cuenta en «presupuestos vivos». */
export const ESTADOS_VIVOS = ["enviado", "visto", "en_conversacion"] as const satisfies readonly Estado[];
/** Estados cerrados: cuentan para la tasa de firma. */
export const ESTADOS_CERRADOS = ["ganado", "perdido", "expirado"] as const satisfies readonly Estado[];

export const UNIDADES = ["ud", "m2", "ml", "m3", "h", "pa"] as const;
export type Unidad = (typeof UNIDADES)[number];

export const URGENCIAS = ["baja", "media", "alta"] as const;
export type Urgencia = (typeof URGENCIAS)[number];

export type EstadoSolicitud = "pendiente" | "convertida" | "descartada";

/**
 * De dónde viene una solicitud. La de Manolo trae mediciones porque él ha visto
 * la obra; la del cliente llega de la web sin ellas: sin visita no hay precio.
 */
export const ORIGENES = ["manolo", "cliente"] as const;
export type Origen = (typeof ORIGENES)[number];

export const TIPOS_TAREA = ["seguimiento_1", "seguimiento_2", "cierre"] as const;
export type TipoTarea = (typeof TIPOS_TAREA)[number];
export type EstadoTarea = "pendiente" | "enviada" | "cancelada";

export type Dispositivo = "movil" | "tablet" | "ordenador";

/** Las secciones de la página pública que mide el tracking. */
export const SECCIONES = ["cabecera", "capitulos", "opcionales", "total", "condiciones", "firma"] as const;
export type Seccion = (typeof SECCIONES)[number];

/** Tipos de evento del timeline. Cada uno se convierte en una frase humana. */
export const TIPOS_EVENTO = [
  "creado",
  "enviado",
  "abierto",
  "seccion_leida",
  "respuesta_cliente",
  "seguimiento_enviado",
  "seguimiento_cancelado",
  "cambio_estado",
  "aviso_enviado",
  "firmado",
  "opcional_marcado",
  "pdf_descargado",
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/* --------------------------------------------------------------- importes */

/** Lo que calcularImportes() necesita de cada línea. Precio y total, en céntimos. */
export type LineaCalculo = {
  medicion: number;
  precio: number;
  margenPct: number;
  opcional: boolean;
  elegida: boolean;
};

export type Importes = {
  /** Suma de las líneas que cuentan, ya con el descuento aplicado. */
  base: number;
  ivaImporte: number;
  /** El importe del presupuesto en tarjetas, columnas y métricas. */
  total: number;
  coste: number;
  /** (base − coste) / base × 100. */
  margenPct: number;
};

/* --------------------------------------------------------------------- IA */

/** Un concepto tal y como salió de la visita: todavía sin precio. */
export type ConceptoCrudo = {
  descripcion: string;
  medicion: number | null;
  unidad: Unidad | null;
  notas: string | null;
};

export type VisitaExtraida = {
  clienteNombre: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  titulo: string;
  urgencia: Urgencia;
  conceptos: ConceptoCrudo[];
};

/** La propuesta de la IA para un concepto. El precio lo pone el servidor desde el banco. */
export type Casacion = {
  /** Índice del concepto dentro de la lista que se le pasó. */
  indice: number;
  /** Código del banco, o null si ninguna partida encaja de verdad. */
  codigo: string | null;
  medicion: number;
  /** 0 a 1. Por debajo de 0,6 la línea sale amarilla. */
  confianza: number;
  motivo: string;
};

export type TextoSeguimiento = {
  tipo: TipoTarea;
  asunto: string;
  texto: string;
};

/** Paso 1: entender la visita. No valora ni pone precios. */
export type ExtraerVisita = (texto: string) => Promise<VisitaExtraida>;
/** Paso 2: casar los conceptos con el banco de precios activo. */
export type CasarConceptos = (conceptos: ConceptoCrudo[]) => Promise<Casacion[]>;
/** Los tres textos de seguimiento, redactados al enviar. */
export type RedactarSeguimientos = (presupuestoId: number) => Promise<TextoSeguimiento[]>;

/* ----------------------------------------------------------------- motor */

export type EnvioPresupuesto = { token: string; url: string };

/** Una apertura (sin sección) o el tiempo leído en una sección. */
export type Lectura = {
  presupuestoId: number;
  visitanteId: string;
  seccion?: Seccion | null;
  duracionS?: number | null;
  ip?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  dispositivo?: Dispositivo | null;
};

export type ResultadoTick = {
  /** Tareas de seguimiento ejecutadas. */
  tareas: number;
  /** Presupuestos que han pasado a Expirado. */
  expirados: number;
};

/** Pasa el presupuesto a Enviado, genera el enlace y programa los tres seguimientos. */
export type EnviarPresupuesto = (presupuestoId: number) => Promise<EnvioPresupuesto>;
/** Registra la lectura, alimenta el timeline y dispara el aviso agrupado. */
export type RegistrarLectura = (lectura: Lectura) => Promise<void>;
/** Campana del panel y, si hay claves, Telegram. Agrupado por presupuesto y minuto. */
export type Notificar = (presupuestoId: number | null, texto: string) => Promise<void>;
/** Ejecuta lo vencido y expira lo caducado. Lo llama el polling y el reloj de demo. */
export type Tick = () => Promise<ResultadoTick>;

/* ------------------------------------------------------------- plantillas */

export type LineaPlantilla = {
  codigo: string | null;
  capitulo: string;
  descripcion: string;
  unidad: Unidad;
  medicion: number;
  opcional: boolean;
};

/* ------------------------------------------------- dónde vive cada cuerpo */
//
// Las firmas de arriba son el contrato. Los cuerpos:
//   · calcularImportes ......... src/lib/importes.ts        (hecho)
//   · extraerVisita ............ src/lib/ia.ts              (carril A, fase 1)
//   · casarConceptos ........... src/lib/ia.ts              (carril A, fase 2)
//   · redactarSeguimientos ..... src/lib/ia.ts              (carril A, fase 2)
//   · enviarPresupuesto ........ src/lib/envio.ts           (hecho)
//   · registrarLectura ......... src/lib/lecturas.ts        (carril C1, fase 5)
//   · notificar ................ src/lib/avisos.ts          (carril C1, fase 5)
//   · tick ..................... src/lib/tick.ts            (carril C2, fase 6)
//
// Y las tres piezas que mutan un presupuesto, de uso obligatorio para todos:
//   · registrarEvento / cambiarEstado / cancelarTareas / marcarRespuesta
//                              ... src/lib/eventos.ts
//   · recalcular / crearPresupuesto / anadirLinea / lineaDesdePartida
//                              ... src/lib/presupuestos.ts  (NuevoPresupuesto, EntradaLinea)
//   · enviarPresupuesto / reenviar / textosDeSeguimiento
//                              ... src/lib/envio.ts
