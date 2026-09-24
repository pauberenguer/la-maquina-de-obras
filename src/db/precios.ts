// Importador del banco de precios desde CSV. Lo usa el seed y la página Precios.
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { resolve } from "node:path";
import { db, partida } from "./index";
import type { Unidad } from "@/lib/tipos";

export const RUTA_BANCO = "data/base-precios.csv";

const UNIDAD_CSV: Record<string, Unidad> = {
  ud: "ud",
  "m²": "m2",
  m2: "m2",
  ml: "ml",
  "m³": "m3",
  m3: "m3",
  h: "h",
  pa: "pa",
};

export type FilaBanco = {
  codigo: string;
  capitulo: string;
  nombre: string;
  unidad: Unidad;
  /** En céntimos. */
  precio: number;
  margenObjetivo: number;
};

/** Parte una línea CSV respetando las comillas dobles. */
function partirLinea(linea: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else entreComillas = !entreComillas;
    } else if (c === "," && !entreComillas) {
      campos.push(actual);
      actual = "";
    } else actual += c;
  }
  campos.push(actual);
  return campos.map((c) => c.trim());
}

/** Lee el CSV y devuelve las filas válidas. Lanza si el formato no es el esperado. */
export function leerBanco(csv: string): FilaBanco[] {
  const lineas = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lineas.length < 2) throw new Error("El CSV del banco de precios está vacío");
  const cabecera = partirLinea(lineas[0]).map((c) => c.toLowerCase());
  const esperada = ["codigo", "capitulo", "partida", "unidad", "precio", "margen_objetivo"];
  for (const columna of esperada) {
    if (!cabecera.includes(columna)) {
      throw new Error(`Al CSV le falta la columna «${columna}»`);
    }
  }
  const indice = (columna: string) => cabecera.indexOf(columna);

  return lineas.slice(1).map((linea, n) => {
    const campos = partirLinea(linea);
    const unidadCruda = campos[indice("unidad")];
    const unidad = UNIDAD_CSV[unidadCruda];
    if (!unidad) throw new Error(`Unidad desconocida «${unidadCruda}» en la fila ${n + 2}`);
    const precio = Number(campos[indice("precio")].replace(",", "."));
    const margen = Number(campos[indice("margen_objetivo")].replace(",", "."));
    if (!Number.isFinite(precio) || !Number.isFinite(margen)) {
      throw new Error(`Precio o margen no numérico en la fila ${n + 2}`);
    }
    return {
      codigo: campos[indice("codigo")],
      capitulo: campos[indice("capitulo")],
      nombre: campos[indice("partida")],
      unidad,
      precio: Math.round(precio * 100),
      margenObjetivo: margen,
    };
  });
}

/** Lee el CSV del disco. */
export function leerBancoDelDisco(ruta = RUTA_BANCO): FilaBanco[] {
  return leerBanco(readFileSync(resolve(process.cwd(), ruta), "utf8"));
}

/**
 * Mete las filas en la tabla partida. Las que ya existen se actualizan por
 * código; las nuevas se dan de alta. No borra nada.
 *
 * Todo va en un único lote (una transacción, un viaje a la base) y en el orden
 * del CSV, que es el orden en que se hace la obra.
 */
export async function importarBanco(
  filas: FilaBanco[],
): Promise<{ altas: number; actualizadas: number }> {
  const existentes = new Set(
    (await db.select({ codigo: partida.codigo }).from(partida).all()).map((p) => p.codigo),
  );
  let altas = 0;
  let actualizadas = 0;
  const escrituras = filas.map((fila) => {
    if (!existentes.has(fila.codigo)) {
      altas++;
      return db.insert(partida).values({ ...fila, activa: true });
    }
    actualizadas++;
    return db
      .update(partida)
      .set({
        capitulo: fila.capitulo,
        nombre: fila.nombre,
        unidad: fila.unidad,
        precio: fila.precio,
        margenObjetivo: fila.margenObjetivo,
      })
      .where(eq(partida.codigo, fila.codigo));
  });
  if (escrituras.length) {
    await db.batch(escrituras as [(typeof escrituras)[number], ...(typeof escrituras)[number][]]);
  }
  return { altas, actualizadas };
}
