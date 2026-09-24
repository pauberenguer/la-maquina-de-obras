// Leer los números como los escribe Manolo: en castellano, con la coma
// decimal y el punto de los miles. Este fichero es seguro en el navegador.

/**
 * «1.234,56» → 1234.56 · «22,5» → 22.5 · «1.250» → 1250 · «22.5» → 22.5
 *
 * La regla: si hay coma, manda la coma y el punto es separador de miles. Si no
 * hay coma, un punto seguido de tres cifras es separador de miles (1.250) y en
 * cualquier otro caso es la coma decimal escrita a la inglesa (22.5).
 */
export function aNumero(texto: string): number {
  const limpio = texto.replace(/[\s€%]/g, "").trim();
  if (!limpio) return NaN;
  if (limpio.includes(",")) return Number(limpio.replace(/\./g, "").replace(",", "."));
  if (/^-?\d{1,3}(\.\d{3})+$/.test(limpio)) return Number(limpio.replace(/\./g, ""));
  return Number(limpio);
}

/** «1.234,56» → 123456 céntimos. Devuelve NaN si no es un número. */
export function aCentimos(texto: string): number {
  const valor = aNumero(texto);
  return Number.isFinite(valor) ? Math.round(valor * 100) : NaN;
}

/** 123456 céntimos → «1234,56», para meterlo en un campo de texto. */
export function centimosAcampo(centimos: number): string {
  return (centimos / 100).toFixed(2).replace(".", ",");
}

/** 22.5 → «22,5», sin ceros de relleno. */
export function numeroAcampo(valor: number): string {
  return String(Math.round(valor * 100) / 100).replace(".", ",");
}
