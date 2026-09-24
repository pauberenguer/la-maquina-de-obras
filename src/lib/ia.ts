// La IA dentro del producto. Dos trabajos y nada más:
//   1 · entender la visita y casarla con el banco de precios (fases 1 y 2);
//   2 · redactar los tres seguimientos al enviar (fase 4).
//
// Siempre en el servidor, siempre con salida estructurada validada por Zod:
// nunca se parsea texto libre del modelo.
//
// Lo que la IA NO hace, nunca: poner un precio, calcular un importe, decidir un
// estado ni inventarse un código de partida. Eso es del servidor.
//
// DUEÑO: carril A. El resto de la sesión no toca este fichero.
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { bancoDePrecios, elNegocio, lineasDe, presupuestoPorId } from "./consultas";
import { formatoEuros, formatoEurosCorto, formatoMedicion, formatoUnidad } from "./formato";
import { UNIDADES, URGENCIAS } from "./tipos";
import type {
  Casacion,
  ConceptoCrudo,
  TextoSeguimiento,
  Unidad,
  Urgencia,
  VisitaExtraida,
} from "./tipos";

export const MODELO = process.env.OPENAI_MODEL ?? "gpt-5.6-terra";
export const ESFUERZO = (process.env.OPENAI_EFFORT ?? "high") as "low" | "medium" | "high";

/** ¿Está la IA configurada? Si no, la interfaz lo dice con claridad. */
export function hayIa(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export class SinClaveDeIa extends Error {
  constructor() {
    super(
      "Falta OPENAI_API_KEY en .env.local: sin ella la máquina no puede leer la visita. Añádela y vuelve a intentarlo.",
    );
    this.name = "SinClaveDeIa";
  }
}

let clienteCache: OpenAI | null = null;

export function cliente(): OpenAI {
  if (!hayIa()) throw new SinClaveDeIa();
  return (clienteCache ??= new OpenAI());
}

/** Cuando el modelo responde pero sin salida estructurada: no se adivina nada. */
class SinRespuestaDeIa extends Error {
  constructor(trabajo: string) {
    super(`La IA ha respondido sin la estructura esperada al ${trabajo}. Vuelve a intentarlo.`);
    this.name = "SinRespuestaDeIa";
  }
}

/* ------------------------------------------------------------------------ */
/* Las unidades del oficio, tal y como se dicen y tal y como se guardan.     */
/* ------------------------------------------------------------------------ */

const UNIDADES_EXPLICADAS = [
  "ud = unidad (una puerta, un inodoro, un contenedor)",
  "m2 = metro cuadrado (alicatados, solados, pintura)",
  "ml = metro lineal (mobiliario de cocina, encimeras, rodapiés, armarios)",
  "m3 = metro cúbico (escombro)",
  "h = hora (mano de obra suelta)",
  "pa = partida alzada (protecciones, limpieza final, gestiones, remates)",
].join(" · ");

/* ------------------------------------------------------------------------ */
/* Trabajo 1 · Paso 1: entender la visita.                                  */
/* ------------------------------------------------------------------------ */

const ConceptoIa = z.object({
  descripcion: z
    .string()
    .describe("Descripción corta del trabajo, en castellano de oficio. Sin precios ni importes."),
  medicion: z
    .number()
    .nullable()
    .describe("La medición SOLO si se ha dicho en la visita. Si no se ha dicho, null."),
  unidad: z
    .enum(UNIDADES)
    .nullable()
    .describe("La unidad de esa medición SOLO si se deduce de lo dicho. Si no, null."),
  notas: z
    .string()
    .nullable()
    .describe("Detalle relevante que se haya dicho (gama, color, condicionantes). Si no hay, null."),
});

const VisitaIa = z.object({
  clienteNombre: z.string().nullable().describe("Nombre del cliente si se dice. Si no, null."),
  telefono: z.string().nullable().describe("Teléfono si se dice. Si no, null."),
  email: z.string().nullable().describe("Email si se dice. Si no, null."),
  direccion: z
    .string()
    .nullable()
    .describe("Dirección de la obra tal y como se dice (calle, número, piso, población)."),
  titulo: z
    .string()
    .describe(
      "Título corto de la obra, como lo escribiría un jefe de obra: «Reforma de baño», «Cocina completa con isla», «Pintura integral de piso de 90 m²».",
    ),
  urgencia: z
    .enum(URGENCIAS)
    .describe(
      "alta si el cliente mete prisa o hay una fecha que corre; baja si se habla de más adelante o sin fecha; media en el resto.",
    ),
  conceptos: z
    .array(ConceptoIa)
    .describe("Todos los trabajos mencionados, en el orden en que se cuentan."),
});

const INSTRUCCIONES_VISITA = `Eres el ayudante de Manolo, jefe de Reformas Soler (Barcelona). Manolo acaba de salir de una visita a un piso y te dicta o te pega sus notas.

Tu único trabajo es ENTENDER lo que ha dicho y ordenarlo. No valoras, no pones precios, no estimas importes y no añades trabajos que Manolo no haya mencionado.

Reglas:
- Saca un concepto por cada trabajo mencionado, en el orden en que se cuentan.
- La medición, SOLO si se ha dicho. «Unos cuarenta metros» es 40. «Hay que pintar el piso» sin metros es medicion null.
- Unidades posibles: ${UNIDADES_EXPLICADAS}.
- Si se dice una cantidad sin unidad clara pero se deduce del trabajo (alicatar → m2, mueble de cocina → ml, puertas → ud), pon la unidad deducida.
- El dictado viene de voz: puede traer muletillas, frases cortadas y números escritos con letra. Interpreta con sentido común de obra, pero no te inventes nada que no esté.
- Si Manolo no dice el nombre del cliente, el teléfono o el email, son null. No los deduzcas de la dirección.
- Todo en castellano.`;

/** Fase 1 · Del texto dictado o pegado saca cliente, dirección, urgencia y conceptos. */
export async function extraerVisita(texto: string): Promise<VisitaExtraida> {
  const limpio = texto.trim();
  if (!limpio) throw new Error("No hay nada que leer: dicta la visita o pega tus notas.");

  const respuesta = await cliente().responses.parse({
    model: MODELO,
    reasoning: { effort: ESFUERZO },
    instructions: INSTRUCCIONES_VISITA,
    input: [{ role: "user", content: `Notas de la visita:\n\n«${limpio}»` }],
    text: { format: zodTextFormat(VisitaIa, "visita") },
  });

  const salida = respuesta.output_parsed;
  if (!salida) throw new SinRespuestaDeIa("leer la visita");

  return {
    clienteNombre: vacioANull(salida.clienteNombre),
    telefono: vacioANull(salida.telefono),
    email: vacioANull(salida.email),
    direccion: vacioANull(salida.direccion),
    titulo: salida.titulo.trim() || "Visita sin título",
    urgencia: (URGENCIAS as readonly string[]).includes(salida.urgencia)
      ? (salida.urgencia as Urgencia)
      : "media",
    conceptos: salida.conceptos
      .filter((c) => c.descripcion?.trim())
      .map<ConceptoCrudo>((c) => ({
        descripcion: c.descripcion.trim(),
        medicion: Number.isFinite(c.medicion) && (c.medicion ?? 0) > 0 ? c.medicion : null,
        unidad: (UNIDADES as readonly string[]).includes(c.unidad ?? "")
          ? (c.unidad as Unidad)
          : null,
        notas: vacioANull(c.notas),
      })),
  };
}

function vacioANull(valor: string | null | undefined): string | null {
  const limpio = valor?.trim();
  return limpio ? limpio : null;
}

/* ------------------------------------------------------------------------ */
/* Trabajo 1 · Paso 2: casar los conceptos con el banco de precios.         */
/* ------------------------------------------------------------------------ */

const CasacionIa = z.object({
  indice: z.number().int().describe("El índice del concepto en la lista que se te ha dado."),
  codigo: z
    .string()
    .nullable()
    .describe(
      "El código EXACTO de la partida del banco que mejor encaja, copiado del catálogo. null si ninguna encaja de verdad.",
    ),
  medicion: z
    .number()
    .describe("La medición del concepto expresada en la unidad de esa partida del banco."),
  confianza: z.number().describe("De 0 a 1. Lo seguro que estás de que esa partida es la correcta."),
  motivo: z.string().describe("Una sola frase, en castellano, explicando por qué esa partida o por qué ninguna."),
});

const CasacionesIa = z.object({ casaciones: z.array(CasacionIa) });

const INSTRUCCIONES_CASAR = `Eres el ayudante de Manolo, jefe de Reformas Soler. Tienes el BANCO DE PRECIOS de la empresa y una lista de conceptos sacados de una visita. Tu trabajo es decir qué partida del banco corresponde a cada concepto.

Reglas que no se saltan:
- El código que devuelvas tiene que estar COPIADO LETRA A LETRA del catálogo que se te da. NUNCA te inventes un código, ni lo compongas, ni lo aproximes. Si ninguna partida encaja de verdad, devuelve codigo null: es una respuesta perfectamente válida y es preferible a forzar una partida que no es.
- Si una descripción encaja con varias partidas, elige la MÁS ESPECÍFICA.
- Si dudas entre dos gamas (media y alta), elige la GAMA MEDIA.
- La medición va SIEMPRE en la unidad de la partida elegida. Si el concepto viene en otra unidad, conviértela con criterio de obra. Si el concepto no trae medición, propón la que tenga sentido para lo descrito (y si no hay forma de saberlo, 1).
- La confianza es honesta: 0,9 o más cuando la partida es literalmente lo descrito; alrededor de 0,7 cuando es lo mismo dicho de otra forma; por debajo de 0,6 cuando dudas de verdad. Por debajo de 0,6 la línea saldrá marcada en amarillo para que Manolo la revise, y eso está bien.
- Devuelve exactamente una casación por concepto, con su índice.
- El motivo, una frase, en castellano de oficio.

No pones precios ni importes: de eso se encarga el servidor con el banco.`;

/** Fase 2 · Casa cada concepto con una partida del banco. El precio lo pone el servidor. */
export async function casarConceptos(conceptos: ConceptoCrudo[]): Promise<Casacion[]> {
  if (conceptos.length === 0) return [];

  const banco = await bancoDePrecios(true);
  if (banco.length === 0) {
    throw new Error("El banco de precios está vacío: impórtalo desde Precios antes de convertir.");
  }

  const catalogo = banco
    .map((p) => `${p.codigo} | ${p.capitulo} | ${p.nombre} | ${formatoUnidad(p.unidad)}`)
    .join("\n");

  const lista = conceptos
    .map((c, i) => {
      const medida =
        c.medicion != null
          ? ` — medición dicha: ${formatoMedicion(c.medicion)}${c.unidad ? ` ${formatoUnidad(c.unidad)}` : ""}`
          : " — sin medición dicha";
      return `[${i}] ${c.descripcion}${medida}${c.notas ? ` (${c.notas})` : ""}`;
    })
    .join("\n");

  const respuesta = await cliente().responses.parse({
    model: MODELO,
    reasoning: { effort: ESFUERZO },
    instructions: INSTRUCCIONES_CASAR,
    input: [
      {
        role: "user",
        content: `BANCO DE PRECIOS (código | capítulo | partida | unidad):\n${catalogo}\n\nCONCEPTOS DE LA VISITA:\n${lista}\n\nDevuelve una casación por cada concepto, con su índice.`,
      },
    ],
    text: { format: zodTextFormat(CasacionesIa, "casaciones") },
  });

  const salida = respuesta.output_parsed;
  if (!salida) throw new SinRespuestaDeIa("casar las partidas");

  // Se reconstruye la lista completa por índice: si la IA se deja un concepto,
  // ese concepto sale amarillo, nunca desaparece.
  const porIndice = new Map<number, (typeof salida.casaciones)[number]>();
  for (const c of salida.casaciones) {
    if (Number.isInteger(c.indice) && c.indice >= 0 && c.indice < conceptos.length) {
      porIndice.set(c.indice, c);
    }
  }

  return conceptos.map<Casacion>((concepto, indice) => {
    const casada = porIndice.get(indice);
    if (!casada) {
      return {
        indice,
        codigo: null,
        medicion: concepto.medicion ?? 1,
        confianza: 0,
        motivo: "La máquina no ha sabido asignarle ninguna partida del banco.",
      };
    }
    const medicion =
      Number.isFinite(casada.medicion) && casada.medicion > 0
        ? casada.medicion
        : (concepto.medicion ?? 1);
    return {
      indice,
      codigo: casada.codigo?.trim() ? casada.codigo.trim().toUpperCase() : null,
      medicion,
      confianza: Math.min(1, Math.max(0, Number(casada.confianza) || 0)),
      motivo: casada.motivo?.trim() || "Sin motivo.",
    };
  });
}

/* ------------------------------------------------------------------------ */
/* Trabajo 2 · Redactar los tres seguimientos.                              */
/* ------------------------------------------------------------------------ */

const SeguimientoIa = z.object({
  tipo: z.enum(["seguimiento_1", "seguimiento_2", "cierre"]),
  asunto: z.string().describe("Asunto corto, como el de un email o un WhatsApp."),
  texto: z.string().describe("El mensaje entero, de 60 a 90 palabras, firmado por Manolo."),
});

const SeguimientosIa = z.object({ seguimientos: z.array(SeguimientoIa) });

const INSTRUCCIONES_SEGUIMIENTOS = `Escribes como Manolo, jefe de Reformas Soler (Barcelona), una empresa de reformas de ocho personas. Acabas de mandarle un presupuesto a un cliente y preparas los tres mensajes de seguimiento que saldrán solos a los 3, 7 y 14 días.

Cómo escribe Manolo: cercano y profesional, de tú, castellano de oficio, sin marketing, sin emojis, sin exclamaciones de vendedor. Habla como quien lleva veinte años entrando en pisos.

Los tres mensajes, cada uno con SU ángulo y sin repetirse:
1. seguimiento_1 (3 días) · recordatorio amable: ¿ha podido verlo con calma?, ofrecerse a repasar las partidas o los plazos sin compromiso.
2. seguimiento_2 (7 días) · el precio: ¿os encajó el precio o lo ajustamos por fases?, la idea de separar la obra en dos entregas.
3. cierre (14 días) · la caducidad: avisar de que el presupuesto caduca en los días que se te digan, con esa cifra exacta, y ofrecer cerrarlo antes.

Reglas:
- Entre 60 y 90 palabras cada uno. Cortos de verdad.
- Empieza por el nombre de pila del cliente y firma como Manolo.
- Puedes mencionar la obra y el importe si viene a cuento, pero no repitas el presupuesto entero.
- Los textos base que te doy son el tono de la casa: respétalo, pero escribe mensajes nuevos y personalizados con esta obra concreta. No dejes ningún hueco tipo {cliente} sin rellenar.
- Devuelve los tres, con su tipo.`;

/** Fase 4 · Los tres textos de seguimiento, en el momento de enviar. */
export async function redactarSeguimientos(presupuestoId: number): Promise<TextoSeguimiento[]> {
  const [presupuesto, negocio, lineas] = await Promise.all([
    presupuestoPorId(presupuestoId),
    elNegocio(),
    lineasDe(presupuestoId),
  ]);
  if (!presupuesto) throw new Error(`No existe el presupuesto ${presupuestoId}`);

  // Las líneas que cuentan, de mayor a menor importe: las que definen la obra.
  const principales = lineas
    .filter((l) => !l.opcional && l.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map(
      (l) =>
        `· ${l.descripcion} — ${formatoMedicion(l.medicion)} ${formatoUnidad(l.unidad)} — ${formatoEuros(l.total)}`,
    )
    .join("\n");

  // El tercer toque sale a los 14 días: lo que queda de validez en ese momento.
  const diasAlCaducar = Math.max(0, presupuesto.caducidadDias - 14);
  const diasEnPalabras =
    diasAlCaducar <= 0 ? "menos de un día" : diasAlCaducar === 1 ? "1 día" : `${diasAlCaducar} días`;

  const respuesta = await cliente().responses.parse({
    model: MODELO,
    reasoning: { effort: ESFUERZO },
    instructions: INSTRUCCIONES_SEGUIMIENTOS,
    input: [
      {
        role: "user",
        content: [
          `EL PRESUPUESTO`,
          `Cliente: ${presupuesto.clienteNombre}`,
          `Obra: ${presupuesto.titulo}`,
          `Dirección: ${presupuesto.direccionObra}`,
          `Total con IVA: ${formatoEurosCorto(presupuesto.total)}`,
          `Validez: ${presupuesto.caducidadDias} días desde el envío, así que cuando salga el tercer mensaje quedarán ${diasEnPalabras}.`,
          ``,
          `LÍNEAS PRINCIPALES`,
          principales || "· (sin líneas)",
          ``,
          `TEXTOS BASE DE LA CASA (el tono, no el texto final)`,
          `1 · ${negocio.seguimiento1}`,
          `2 · ${negocio.seguimiento2}`,
          `3 · ${negocio.seguimiento3}`,
        ].join("\n"),
      },
    ],
    text: { format: zodTextFormat(SeguimientosIa, "seguimientos") },
  });

  const salida = respuesta.output_parsed;
  if (!salida) throw new SinRespuestaDeIa("redactar los seguimientos");

  return salida.seguimientos
    .filter((s) => s.texto?.trim())
    .map<TextoSeguimiento>((s) => ({
      tipo: s.tipo,
      asunto: s.asunto?.trim() || "Sobre tu presupuesto",
      texto: s.texto.trim(),
    }));
}
