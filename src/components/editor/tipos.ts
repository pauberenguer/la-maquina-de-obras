// Los tipos que se pasan el editor y sus acciones. Viven fuera del fichero
// "use server" porque de ahí solo pueden salir funciones asíncronas.
import type { Unidad } from "@/lib/tipos";

/** Una línea tal y como la maneja el editor en el navegador. */
export type LineaEditable = {
  id: number;
  partidaId: number | null;
  capitulo: string;
  descripcion: string;
  unidad: Unidad;
  medicion: number;
  /** Céntimos. */
  precio: number;
  precioManual: boolean;
  margenPct: number;
  /** El margen que el banco marca como objetivo para esta partida. */
  margenObjetivo: number;
  /** Céntimos. */
  total: number;
  amarilla: boolean;
  opcional: boolean;
  elegida: boolean;
  orden: number;
  confianza: number | null;
  motivoIa: string | null;
};

/** Los importes del presupuesto tal y como los deja el servidor. */
export type ImportesGuardados = {
  base: number;
  ivaImporte: number;
  total: number;
  coste: number;
  margenPct: number;
  descuentoPct: number;
};

/** Lo que devuelve cada acción del editor. */
export type Resultado =
  | { ok: true; importes: ImportesGuardados; linea?: LineaEditable }
  | { ok: false; mensaje: string };

export type CamposLinea = {
  descripcion?: string;
  unidad?: string;
  medicion?: number;
  /** Céntimos. Solo se admite si la línea NO viene del banco. */
  precio?: number;
  margenPct?: number;
};

/** Una partida del banco, tal y como la ve el buscador del editor. */
export type PartidaBanco = {
  id: number;
  codigo: string;
  capitulo: string;
  nombre: string;
  unidad: Unidad;
  /** Céntimos. */
  precio: number;
  margenObjetivo: number;
};
