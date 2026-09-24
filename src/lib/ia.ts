// La IA dentro del producto. Dos trabajos y nada más:
//   1 · entender la visita y casarla con el banco de precios (fases 1 y 2);
//   2 · redactar los tres seguimientos al enviar (fase 4).
//
// Siempre en el servidor, siempre con salida estructurada validada por Zod:
// nunca se parsea texto libre del modelo.
//
// DUEÑO: carril A. El resto de la sesión no toca este fichero.
import OpenAI from "openai";
import type {
  Casacion,
  ConceptoCrudo,
  TextoSeguimiento,
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

/* ------------------------------------------------------------------------ */
/* Las tres funciones del contrato. Los cuerpos llegan con sus fases.        */
/* ------------------------------------------------------------------------ */

/** Fase 1 · Del texto dictado o pegado saca cliente, dirección, urgencia y conceptos. */
export async function extraerVisita(_texto: string): Promise<VisitaExtraida> {
  throw new Error("extraerVisita llega en la fase 1");
}

/** Fase 2 · Casa cada concepto con una partida del banco. El precio lo pone el servidor. */
export async function casarConceptos(_conceptos: ConceptoCrudo[]): Promise<Casacion[]> {
  throw new Error("casarConceptos llega en la fase 2");
}

/** Fase 4 · Los tres textos de seguimiento, en el momento de enviar. */
export async function redactarSeguimientos(_presupuestoId: number): Promise<TextoSeguimiento[]> {
  throw new Error("redactarSeguimientos llega en la fase 4");
}
