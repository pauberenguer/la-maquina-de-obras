// Crear presupuestos, añadirles líneas y recalcular sus importes.
//
// Dos reglas que este fichero hace cumplir por construcción:
//   · el precio y el margen de una línea SIEMPRE salen del banco o de la mano
//     de Manolo: aquí no se inventa ni uno;
//   · base, IVA, total, coste y margen del presupuesto solo los escribe
//     recalcular(). Nadie los toca a mano.
//
// DUEÑO: sesión principal. Los carriles lo IMPORTAN, no lo editan.
import { randomBytes } from "node:crypto";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { cliente, db, linea, partida, plantilla, presupuesto } from "@/db";
import { elNegocio, type Partida } from "./consultas";
import { registrarEvento } from "./eventos";
import { calcularImportes } from "./importes";
import { ahora, cargarReloj } from "./reloj";
import type { Importes, LineaCalculo, LineaPlantilla, Unidad } from "./tipos";

/** Un token de enlace público que no se puede adivinar. */
export function nuevoToken(): string {
  return randomBytes(16).toString("base64url");
}

/** «2026-038»: el año del presupuesto y el correlativo de ese año. */
export async function siguienteNumero(fecha?: Date): Promise<string> {
  await cargarReloj();
  const anyo = (fecha ?? ahora()).getFullYear();
  const ultimo = (
    await db
      .select({ numero: presupuesto.numero })
      .from(presupuesto)
      .where(like(presupuesto.numero, `${anyo}-%`))
      .orderBy(desc(presupuesto.numero))
      .limit(1)
      .get()
  )?.numero;
  const siguiente = ultimo ? Number(ultimo.slice(5)) + 1 : 1;
  return `${anyo}-${String(siguiente).padStart(3, "0")}`;
}

/* ------------------------------------------------------------- recalcular */

/**
 * Relee las líneas del presupuesto y vuelve a escribir sus importes.
 * Se llama después de CUALQUIER cambio en las líneas, en el descuento o en el
 * IVA. Devuelve los importes resultantes.
 */
export async function recalcular(presupuestoId: number): Promise<Importes> {
  const [cabecera, filas] = await Promise.all([
    db
      .select({ ivaPct: presupuesto.ivaPct, descuentoPct: presupuesto.descuentoPct })
      .from(presupuesto)
      .where(eq(presupuesto.id, presupuestoId))
      .get(),
    db
      .select({
        id: linea.id,
        medicion: linea.medicion,
        precio: linea.precio,
        margenPct: linea.margenPct,
        opcional: linea.opcional,
        elegida: linea.elegida,
        total: linea.total,
      })
      .from(linea)
      .where(eq(linea.presupuestoId, presupuestoId))
      .all(),
  ]);
  if (!cabecera) throw new Error(`No existe el presupuesto ${presupuestoId}`);

  // El total de cada línea también es derivado: se refresca aquí.
  await Promise.all(
    filas
      .filter((f) => Math.round(f.precio * f.medicion) !== f.total)
      .map((f) =>
        db
          .update(linea)
          .set({ total: Math.round(f.precio * f.medicion) })
          .where(eq(linea.id, f.id))
          .run(),
      ),
  );

  const importes = calcularImportes(
    filas.map<LineaCalculo>((f) => ({
      medicion: f.medicion,
      precio: f.precio,
      margenPct: f.margenPct,
      opcional: f.opcional,
      elegida: f.elegida,
    })),
    cabecera.ivaPct,
    cabecera.descuentoPct,
  );

  await db
    .update(presupuesto)
    .set({
      base: importes.base,
      ivaImporte: importes.ivaImporte,
      total: importes.total,
      coste: importes.coste,
      margenPct: importes.margenPct,
    })
    .where(eq(presupuesto.id, presupuestoId))
    .run();

  return importes;
}

/* ------------------------------------------------------------------ altas */

/** Busca un cliente por nombre (sin distinguir mayúsculas) o lo da de alta. */
export async function clienteOAlta(
  nombre: string,
  telefono?: string | null,
  email?: string | null,
): Promise<number> {
  await cargarReloj();
  const limpio = nombre.trim();
  const existente = await db
    .select({ id: cliente.id, telefono: cliente.telefono, email: cliente.email })
    .from(cliente)
    .where(sql`lower(${cliente.nombre}) = lower(${limpio})`)
    .get();
  if (existente) {
    // Si la visita trae un teléfono o un email que no teníamos, se completa.
    const parche: { telefono?: string; email?: string } = {};
    if (telefono && !existente.telefono) parche.telefono = telefono;
    if (email && !existente.email) parche.email = email;
    if (Object.keys(parche).length) {
      await db.update(cliente).set(parche).where(eq(cliente.id, existente.id)).run();
    }
    return existente.id;
  }
  const nuevo = await db
    .insert(cliente)
    .values({
      nombre: limpio,
      telefono: telefono ?? null,
      email: email ?? null,
      notas: null,
      creadoEn: ahora(),
    })
    .returning({ id: cliente.id })
    .get();
  return nuevo.id;
}

export type NuevoPresupuesto = {
  clienteNombre: string;
  telefono?: string | null;
  email?: string | null;
  direccionObra: string;
  titulo: string;
  /** Cuándo fue la visita. Por defecto, ahora. */
  visitaEn?: Date;
  solicitudId?: number | null;
  plantillaId?: number | null;
  /** Días de validez. Por defecto, los de Ajustes. */
  caducidadDias?: number;
};

/** ¿Ha fallado el INSERT por el índice único del número? */
function chocaElNumero(e: unknown): boolean {
  const texto = String((e as { message?: string; cause?: { message?: string } })?.cause?.message ?? (e as Error)?.message ?? e);
  return /UNIQUE/i.test(texto) && /numero/i.test(texto);
}

/**
 * Crea el Borrador con su número, su token y el IVA y la caducidad de Ajustes.
 *
 * El número se calcula leyendo el último: si otra alta llega a la vez y se lo
 * lleva, el índice único lo rechaza y se prueba con el siguiente.
 */
export async function crearPresupuesto(entrada: NuevoPresupuesto): Promise<number> {
  await cargarReloj();
  const [negocio, clienteId] = await Promise.all([
    elNegocio(),
    clienteOAlta(entrada.clienteNombre, entrada.telefono, entrada.email),
  ]);
  const ts = ahora();

  for (let intento = 0; ; intento++) {
    try {
      const fila = await db
        .insert(presupuesto)
        .values({
          numero: await siguienteNumero(ts),
          token: nuevoToken(),
          clienteId,
          direccionObra: entrada.direccionObra,
          titulo: entrada.titulo,
          estado: "borrador",
          ivaPct: negocio.ivaPct,
          caducidadDias: entrada.caducidadDias ?? negocio.caducidadDias,
          visitaEn: entrada.visitaEn ?? ts,
          creadoEn: ts,
          solicitudId: entrada.solicitudId ?? null,
          plantillaId: entrada.plantillaId ?? null,
        })
        .returning({ id: presupuesto.id })
        .get();
      await registrarEvento(fila.id, "creado", { titulo: entrada.titulo }, ts);
      return fila.id;
    } catch (e) {
      if (intento < 4 && chocaElNumero(e)) continue;
      throw e;
    }
  }
}

/* ---------------------------------------------------------------- líneas */

export type EntradaLinea = {
  capitulo: string;
  descripcion: string;
  unidad: Unidad;
  medicion: number;
  /** En céntimos. Solo se pone a mano cuando no hay partida del banco. */
  precio?: number;
  precioManual?: boolean;
  margenPct?: number;
  partidaId?: number | null;
  /** Fuera del banco: sale en amarillo y sin precio hasta que Manolo lo ponga. */
  amarilla?: boolean;
  opcional?: boolean;
  elegida?: boolean;
  confianza?: number | null;
  motivoIa?: string | null;
  orden?: number;
};

/** El siguiente hueco en el orden de las líneas de un presupuesto. */
export async function siguienteOrden(presupuestoId: number): Promise<number> {
  const fila = await db
    .select({ n: sql<number | null>`max(${linea.orden})` })
    .from(linea)
    .where(eq(linea.presupuestoId, presupuestoId))
    .get();
  return (fila?.n ?? -1) + 1;
}

/** Inserta una línea. NO recalcula: quien añade varias llama a recalcular() al final. */
export async function anadirLinea(presupuestoId: number, entrada: EntradaLinea): Promise<number> {
  const precio = entrada.precio ?? 0;
  const medicion = entrada.medicion;
  const fila = await db
    .insert(linea)
    .values({
      presupuestoId,
      partidaId: entrada.partidaId ?? null,
      capitulo: entrada.capitulo,
      descripcion: entrada.descripcion,
      unidad: entrada.unidad,
      medicion,
      precio,
      precioManual: entrada.precioManual ?? false,
      margenPct: entrada.margenPct ?? 0,
      total: Math.round(precio * medicion),
      confianza: entrada.confianza ?? null,
      amarilla: entrada.amarilla ?? entrada.partidaId == null,
      opcional: entrada.opcional ?? false,
      // Una línea opcional nace SIN marcar: la marca el cliente en su página.
      // Si naciera marcada, el importe del presupuesto la contaría de más.
      elegida: entrada.elegida ?? !(entrada.opcional ?? false),
      orden: entrada.orden ?? (await siguienteOrden(presupuestoId)),
      motivoIa: entrada.motivoIa ?? null,
    })
    .returning({ id: linea.id })
    .get();
  return fila.id;
}

/**
 * La línea que corresponde a una partida del banco: el precio y el margen son
 * los del banco, siempre. Es la única forma legítima de que una línea tenga
 * precio sin que Manolo lo escriba.
 */
export function lineaDesdePartida(
  p: Partida,
  medicion: number,
  extra: Partial<EntradaLinea> = {},
): EntradaLinea {
  return {
    capitulo: p.capitulo,
    descripcion: p.nombre,
    unidad: p.unidad as Unidad,
    medicion,
    precio: p.precio,
    margenPct: p.margenObjetivo,
    partidaId: p.id,
    amarilla: false,
    ...extra,
  };
}

/** Una partida activa del banco por su código, o null si no existe. */
export async function partidaPorCodigo(codigo: string): Promise<Partida | null> {
  const fila = await db
    .select()
    .from(partida)
    .where(and(eq(partida.codigo, codigo), eq(partida.activa, true)))
    .get();
  return fila ?? null;
}

/* ------------------------------------------------------------- plantillas */

/**
 * Convierte una plantilla en líneas listas para insertar. Las que llevan
 * código sacan precio y margen del banco; las que no, salen amarillas.
 */
export async function lineasDePlantilla(plantillaId: number): Promise<EntradaLinea[]> {
  const fila = await db.select().from(plantilla).where(eq(plantilla.id, plantillaId)).get();
  if (!fila) throw new Error(`No existe la plantilla ${plantillaId}`);
  const lineas = JSON.parse(fila.lineas) as LineaPlantilla[];

  return Promise.all(
    lineas.map(async (l, i): Promise<EntradaLinea> => {
      const p = l.codigo ? await partidaPorCodigo(l.codigo) : null;
      if (p) return lineaDesdePartida(p, l.medicion, { opcional: l.opcional, orden: i });
      return {
        capitulo: l.capitulo,
        descripcion: l.descripcion,
        unidad: l.unidad,
        medicion: l.medicion,
        opcional: l.opcional,
        amarilla: true,
        orden: i,
        motivoIa: l.codigo
          ? `La partida ${l.codigo} ya no está activa en el banco: ponle precio o cámbiala`
          : null,
      };
    }),
  );
}
