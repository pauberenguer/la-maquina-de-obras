// Aritmética de fechas, sin tocar la base ni el reloj de la aplicación.
// Este fichero es seguro en el navegador; reloj.ts no lo es.

export const UN_MINUTO = 60_000;
export const UNA_HORA = 60 * UN_MINUTO;
export const UN_DIA = 24 * UNA_HORA;

export function masDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * UN_DIA);
}

/** Días completos entre dos instantes (b − a). */
export function diasEntre(a: Date | number, b: Date | number): number {
  const ma = a instanceof Date ? a.getTime() : a;
  const mb = b instanceof Date ? b.getTime() : b;
  return Math.floor((mb - ma) / UN_DIA);
}
