// El cálculo del presupuesto. Es determinista y vive solo aquí: lo usan el
// editor, la página pública del cliente y el seed. Nadie recalcula por su cuenta.
//
// Todo en céntimos enteros.
import type { Importes, LineaCalculo } from "./tipos";

/** total de la línea = precio unitario × medición. */
export function totalLinea(precio: number, medicion: number): number {
  return Math.round(precio * medicion);
}

/** El coste implícito: lo que cuesta la línea una vez quitado su margen. */
export function costeLinea(total: number, margenPct: number): number {
  return Math.round(total * (1 - margenPct / 100));
}

/** ¿Cuenta esta línea en el importe? Las opcionales, solo si están marcadas. */
export function cuenta(linea: Pick<LineaCalculo, "opcional" | "elegida">): boolean {
  return !linea.opcional || linea.elegida;
}

/**
 * Los importes del presupuesto: base (con el descuento ya aplicado), IVA,
 * total con IVA, coste y margen global.
 */
export function calcularImportes(
  lineas: readonly LineaCalculo[],
  ivaPct: number,
  descuentoPct = 0,
): Importes {
  let bruto = 0;
  let coste = 0;
  for (const linea of lineas) {
    if (!cuenta(linea)) continue;
    const total = totalLinea(linea.precio, linea.medicion);
    bruto += total;
    coste += costeLinea(total, linea.margenPct);
  }

  const descuento = Math.round(bruto * (descuentoPct / 100));
  const base = bruto - descuento;
  const ivaImporte = Math.round(base * (ivaPct / 100));
  const total = base + ivaImporte;
  const margenPct = base > 0 ? ((base - coste) / base) * 100 : 0;

  return { base, ivaImporte, total, coste, margenPct };
}

/** El descuento en céntimos que corresponde a un porcentaje sobre las líneas. */
export function importeDescuento(lineas: readonly LineaCalculo[], descuentoPct: number): number {
  let bruto = 0;
  for (const linea of lineas) {
    if (!cuenta(linea)) continue;
    bruto += totalLinea(linea.precio, linea.medicion);
  }
  return Math.round(bruto * (descuentoPct / 100));
}

/** El margen objetivo del presupuesto: la media de los objetivos del banco, ponderada por importe. */
export function margenObjetivo(
  lineas: readonly (LineaCalculo & { margenObjetivo?: number })[],
): number {
  let peso = 0;
  let suma = 0;
  for (const linea of lineas) {
    if (!cuenta(linea)) continue;
    const total = totalLinea(linea.precio, linea.medicion);
    peso += total;
    suma += total * (linea.margenObjetivo ?? linea.margenPct);
  }
  return peso > 0 ? suma / peso : 0;
}

/** Agrupa las líneas por capítulo conservando el orden de aparición. */
export function porCapitulos<T extends { capitulo: string }>(lineas: readonly T[]): [string, T[]][] {
  const grupos = new Map<string, T[]>();
  for (const linea of lineas) {
    const grupo = grupos.get(linea.capitulo);
    if (grupo) grupo.push(linea);
    else grupos.set(linea.capitulo, [linea]);
  }
  return [...grupos.entries()];
}
