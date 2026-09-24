// Esquema completo de La Máquina de Obras.
//
// Dos convenciones que valen para todo el fichero:
//   · el dinero se guarda en CÉNTIMOS enteros (nunca en coma flotante);
//   · las fechas se guardan en milisegundos y se leen siempre con ahora().
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const ts = (nombre: string) => integer(nombre, { mode: "timestamp_ms" });
const bool = (nombre: string) => integer(nombre, { mode: "boolean" });

/** Los datos de Reformas Soler y la configuración del producto. Fila única (id = 1). */
export const negocio = sqliteTable("negocio", {
  id: integer("id").primaryKey(),
  nombre: text("nombre").notNull(),
  cif: text("cif").notNull(),
  direccion: text("direccion").notNull(),
  telefono: text("telefono").notNull(),
  email: text("email").notNull(),
  colorMarca: text("color_marca").notNull(),
  ivaPct: real("iva_pct").notNull(),
  condiciones: text("condiciones").notNull(),
  seguimiento1: text("seguimiento_1").notNull(),
  seguimiento2: text("seguimiento_2").notNull(),
  seguimiento3: text("seguimiento_3").notNull(),
  caducidadDias: integer("caducidad_dias").notNull(),
  /** El día en que Manolo empezó a usar el sistema: parte en dos las métricas. */
  fechaAlta: ts("fecha_alta").notNull(),
  /** Desplazamiento del reloj de la demo, en milisegundos. Lo mueve la barra del reloj. */
  relojOffsetMs: integer("reloj_offset_ms").notNull().default(0),
  /** La base está cargada con el seed de ejemplo: la interfaz lo declara. */
  datosEjemplo: bool("datos_ejemplo").notNull().default(true),
});

/** El banco de precios. Única fuente de precios del sistema junto a lo que escribe Manolo. */
export const partida = sqliteTable(
  "partida",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    codigo: text("codigo").notNull(),
    capitulo: text("capitulo").notNull(),
    nombre: text("nombre").notNull(),
    unidad: text("unidad").notNull(),
    /** Precio sin IVA, en céntimos. */
    precio: integer("precio").notNull(),
    margenObjetivo: real("margen_objetivo").notNull(),
    activa: bool("activa").notNull().default(true),
  },
  (t) => [uniqueIndex("partida_codigo").on(t.codigo), index("partida_capitulo").on(t.capitulo)],
);

export const cliente = sqliteTable("cliente", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull(),
  telefono: text("telefono"),
  email: text("email"),
  notas: text("notas"),
  creadoEn: ts("creado_en").notNull(),
});

/**
 * Una solicitud que todavía no es presupuesto. Nace de dos sitios: la visita que
 * dicta o pega Manolo (origen «manolo», con conceptos y mediciones) o el
 * formulario público de /solicitar (origen «cliente», sin visita ni mediciones).
 */
export const solicitud = sqliteTable(
  "solicitud",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clienteNombre: text("cliente_nombre").notNull(),
    telefono: text("telefono"),
    email: text("email"),
    direccion: text("direccion").notNull(),
    titulo: text("titulo").notNull(),
    urgencia: text("urgencia").notNull(),
    textoOriginal: text("texto_original").notNull(),
    /** ConceptoCrudo[] serializado: lo que la IA entendió de la visita. */
    conceptos: text("conceptos").notNull(),
    /** «manolo» o «cliente». La del cliente sale sin precios: nadie ha visto la obra. */
    origen: text("origen").notNull().default("manolo"),
    estado: text("estado").notNull().default("pendiente"),
    presupuestoId: integer("presupuesto_id"),
    creadoEn: ts("creado_en").notNull(),
  },
  (t) => [index("solicitud_estado").on(t.estado)],
);

/**
 * Las peticiones públicas que cuentan para un límite por IP: cada solicitud
 * enviada desde /solicitar y cada contraseña fallida en /entrar. Se consulta
 * por ventana de tiempo y se purga sola.
 */
export const peticionWeb = sqliteTable(
  "peticion_web",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ip: text("ip").notNull(),
    /** «solicitar» o «entrar». */
    motivo: text("motivo").notNull(),
    ts: ts("ts").notNull(),
  },
  (t) => [index("peticion_ip").on(t.ip, t.motivo, t.ts)],
);

export const presupuesto = sqliteTable(
  "presupuesto",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    numero: text("numero").notNull(),
    /** Token no adivinable del enlace público /p/[token]. */
    token: text("token").notNull(),
    clienteId: integer("cliente_id")
      .notNull()
      .references(() => cliente.id),
    direccionObra: text("direccion_obra").notNull(),
    titulo: text("titulo").notNull(),
    estado: text("estado").notNull().default("borrador"),
    ivaPct: real("iva_pct").notNull(),
    descuentoPct: real("descuento_pct").notNull().default(0),
    /** Importes en céntimos, calculados siempre por calcularImportes(). */
    base: integer("base").notNull().default(0),
    ivaImporte: integer("iva_importe").notNull().default(0),
    total: integer("total").notNull().default(0),
    coste: integer("coste").notNull().default(0),
    margenPct: real("margen_pct").notNull().default(0),
    caducidadDias: integer("caducidad_dias").notNull(),
    validoHasta: ts("valido_hasta"),
    visitaEn: ts("visita_en").notNull(),
    creadoEn: ts("creado_en").notNull(),
    enviadoEn: ts("enviado_en"),
    cerradoEn: ts("cerrado_en"),
    motivoPerdido: text("motivo_perdido"),
    respondioEn: ts("respondio_en"),
    respuestaTexto: text("respuesta_texto"),
    firmaPng: text("firma_png"),
    firmadoEn: ts("firmado_en"),
    firmaIp: text("firma_ip"),
    firmaDispositivo: text("firma_dispositivo"),
    /** Agrupación de avisos: como máximo uno por minuto y presupuesto. */
    ultimoAvisoEn: ts("ultimo_aviso_en"),
    solicitudId: integer("solicitud_id"),
    plantillaId: integer("plantilla_id"),
  },
  (t) => [
    uniqueIndex("presupuesto_numero").on(t.numero),
    uniqueIndex("presupuesto_token").on(t.token),
    index("presupuesto_estado").on(t.estado),
    index("presupuesto_cliente").on(t.clienteId),
  ],
);

export const linea = sqliteTable(
  "linea",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    presupuestoId: integer("presupuesto_id")
      .notNull()
      .references(() => presupuesto.id),
    /** Nulo = la línea no viene del banco: es amarilla hasta que Manolo le ponga precio. */
    partidaId: integer("partida_id").references(() => partida.id),
    capitulo: text("capitulo").notNull(),
    descripcion: text("descripcion").notNull(),
    unidad: text("unidad").notNull(),
    medicion: real("medicion").notNull().default(0),
    /** Precio unitario sin IVA, en céntimos. */
    precio: integer("precio").notNull().default(0),
    precioManual: bool("precio_manual").notNull().default(false),
    margenPct: real("margen_pct").notNull().default(0),
    /** precio × medición, en céntimos. */
    total: integer("total").notNull().default(0),
    confianza: real("confianza"),
    amarilla: bool("amarilla").notNull().default(false),
    opcional: bool("opcional").notNull().default(false),
    elegida: bool("elegida").notNull().default(true),
    orden: integer("orden").notNull().default(0),
    motivoIa: text("motivo_ia"),
  },
  (t) => [index("linea_presupuesto").on(t.presupuestoId)],
);

/** Cada apertura y cada sección leída de la página pública. */
export const eventoLectura = sqliteTable(
  "evento_lectura",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    presupuestoId: integer("presupuesto_id")
      .notNull()
      .references(() => presupuesto.id),
    visitanteId: text("visitante_id").notNull(),
    visitaN: integer("visita_n").notNull().default(1),
    /** Nulo = apertura de la página; con valor = tiempo leído en esa sección. */
    seccion: text("seccion"),
    duracionS: integer("duracion_s"),
    ip: text("ip"),
    ciudad: text("ciudad"),
    pais: text("pais"),
    dispositivo: text("dispositivo"),
    ts: ts("ts").notNull(),
  },
  (t) => [index("lectura_presupuesto").on(t.presupuestoId), index("lectura_ts").on(t.ts)],
);

/** Los tres seguimientos y el cierre, que ejecuta tick() cuando vence ejecutar_en. */
export const tareaProgramada = sqliteTable(
  "tarea_programada",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    presupuestoId: integer("presupuesto_id")
      .notNull()
      .references(() => presupuesto.id),
    tipo: text("tipo").notNull(),
    ejecutarEn: ts("ejecutar_en").notNull(),
    estado: text("estado").notNull().default("pendiente"),
    asunto: text("asunto").notNull(),
    texto: text("texto").notNull(),
    ejecutadaEn: ts("ejecutada_en"),
  },
  (t) => [
    index("tarea_presupuesto").on(t.presupuestoId),
    index("tarea_pendiente").on(t.estado, t.ejecutarEn),
  ],
);

/** El timeline de Actividad, HOY y las métricas se leen de aquí. */
export const evento = sqliteTable(
  "evento",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    presupuestoId: integer("presupuesto_id").references(() => presupuesto.id),
    tipo: text("tipo").notNull(),
    /** JSON con lo que necesite cada tipo de evento para escribir su frase. */
    meta: text("meta").notNull().default("{}"),
    ts: ts("ts").notNull(),
  },
  (t) => [index("evento_presupuesto").on(t.presupuestoId), index("evento_ts").on(t.ts)],
);

export const plantilla = sqliteTable("plantilla", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion").notNull(),
  /** LineaPlantilla[] serializado. */
  lineas: text("lineas").notNull(),
  creadoEn: ts("creado_en").notNull(),
});

/** La campana del panel. */
export const aviso = sqliteTable(
  "aviso",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    presupuestoId: integer("presupuesto_id").references(() => presupuesto.id),
    texto: text("texto").notNull(),
    leido: bool("leido").notNull().default(false),
    ts: ts("ts").notNull(),
  },
  (t) => [index("aviso_leido").on(t.leido), index("aviso_ts").on(t.ts)],
);

/** Contador que el panel consulta cada 3 s para saber si algo ha cambiado. */
export const pulso = sqliteTable("pulso", {
  id: integer("id").primaryKey(),
  version: integer("version").notNull().default(0),
  actualizadoEn: ts("actualizado_en")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
