// Lo que se enseña de una plantilla sin abrirla: cuántas líneas tiene y cuánto
// costaría hoy con los precios que hay ahora mismo en el banco.
//
// El importe es ORIENTATIVO: las mediciones se ajustan en cada obra. El cálculo
// es el de siempre, calcularImportes(), para que no haya dos matemáticas.
import { calcularImportes } from "@/lib/importes";
import { lineasDePlantilla } from "@/lib/presupuestos";
import type { EntradaLinea } from "@/lib/presupuestos";
import type { LineaCalculo } from "@/lib/tipos";

export type ResumenPlantilla = {
  lineas: number;
  opcionales: number;
  fueraDelBanco: number;
  capitulos: string[];
  /** Total con IVA de las líneas no opcionales, en céntimos. */
  total: number;
};

/** Convierte las líneas de una plantilla en lo que necesita calcularImportes(). */
export function paraCalcular(entradas: EntradaLinea[]): LineaCalculo[] {
  return entradas.map((l) => ({
    medicion: l.medicion,
    precio: l.precio ?? 0,
    margenPct: l.margenPct ?? 0,
    opcional: l.opcional ?? false,
    // Los opcionales no entran en el importe orientativo: se marcan en la obra.
    elegida: false,
  }));
}

export async function resumirPlantilla(plantillaId: number, ivaPct: number): Promise<ResumenPlantilla> {
  const entradas = await lineasDePlantilla(plantillaId);
  const { total } = calcularImportes(paraCalcular(entradas), ivaPct);
  return {
    lineas: entradas.length,
    opcionales: entradas.filter((l) => l.opcional).length,
    fueraDelBanco: entradas.filter((l) => l.amarilla).length,
    capitulos: [...new Set(entradas.map((l) => l.capitulo))],
    total,
  };
}
