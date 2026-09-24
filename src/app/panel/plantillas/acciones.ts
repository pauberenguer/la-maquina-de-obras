"use server";
// Las mutaciones de Plantillas: crear un presupuesto desde una plantilla,
// guardar un presupuesto como plantilla y borrar una plantilla.
//
// Ni una línea de cálculo vive aquí: los importes los pone recalcular() y los
// precios salen del banco, como en cualquier otro presupuesto. Como toda
// acción del panel, cada una empieza comprobando la sesión.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, linea, partida, plantilla } from "@/db";
import { anadirLinea, crearPresupuesto, lineasDePlantilla, recalcular } from "@/lib/presupuestos";
import { ahora, cargarReloj } from "@/lib/reloj";
import { exigirSesion } from "@/lib/sesion";
import type { LineaPlantilla, Unidad } from "@/lib/tipos";

export type Resultado = { ok: boolean; mensaje: string };

function campo(datos: FormData, nombre: string): string {
  return String(datos.get(nombre) ?? "").trim();
}

/* -------------------------------------------- un presupuesto desde una plantilla */

export async function crearDesdePlantilla(
  _previo: Resultado | null,
  datos: FormData,
): Promise<Resultado> {
  await exigirSesion();
  await cargarReloj();
  const plantillaId = Number(campo(datos, "plantillaId"));
  const ficha = await db.select().from(plantilla).where(eq(plantilla.id, plantillaId)).get();
  if (!ficha) return { ok: false, mensaje: "Esa plantilla ya no existe." };

  const clienteNombre = campo(datos, "clienteNombre");
  const direccionObra = campo(datos, "direccionObra");
  if (clienteNombre.length < 3) return { ok: false, mensaje: "Escribe el nombre del cliente." };
  if (direccionObra.length < 5) {
    return { ok: false, mensaje: "Escribe la dirección de la obra: sale en el presupuesto." };
  }

  const titulo = campo(datos, "titulo") || ficha.nombre;
  const telefono = campo(datos, "telefono") || null;
  const email = campo(datos, "email") || null;

  let presupuestoId: number;
  try {
    presupuestoId = await crearPresupuesto({
      clienteNombre,
      telefono,
      email,
      direccionObra,
      titulo,
      visitaEn: ahora(),
      plantillaId,
    });
    for (const entrada of await lineasDePlantilla(plantillaId)) {
      // Una línea opcional nace SIN marcar: la marca el cliente en su página.
      // Es la convención del seed (elegida = !opcional) y la que hace que el
      // importe del presupuesto sea el mismo que el orientativo de la plantilla.
      await anadirLinea(presupuestoId, { ...entrada, elegida: !entrada.opcional });
    }
    await recalcular(presupuestoId);
  } catch (e) {
    return { ok: false, mensaje: `No se ha podido crear el presupuesto: ${(e as Error).message}` };
  }

  revalidatePath("/panel/presupuestos");
  revalidatePath("/panel/plantillas");
  redirect(`/panel/presupuestos/${presupuestoId}/editar`);
}

/* --------------------------------------- un presupuesto guardado como plantilla */

/** Las líneas de un presupuesto, en el formato que guarda una plantilla. */
async function lineasComoPlantilla(presupuestoId: number): Promise<LineaPlantilla[]> {
  const filas = await db
    .select({
      codigo: partida.codigo,
      capitulo: linea.capitulo,
      descripcion: linea.descripcion,
      unidad: linea.unidad,
      medicion: linea.medicion,
      opcional: linea.opcional,
    })
    .from(linea)
    .leftJoin(partida, eq(linea.partidaId, partida.id))
    .where(eq(linea.presupuestoId, presupuestoId))
    .orderBy(asc(linea.orden))
    .all();
  return filas.map((l) => ({
      codigo: l.codigo ?? null,
      capitulo: l.capitulo,
      descripcion: l.descripcion,
      unidad: l.unidad as Unidad,
      medicion: l.medicion,
      opcional: l.opcional,
    }));
}

export async function guardarComoPlantilla(
  _previo: Resultado | null,
  datos: FormData,
): Promise<Resultado> {
  await exigirSesion();
  await cargarReloj();
  const presupuestoId = Number(campo(datos, "presupuestoId"));
  const nombre = campo(datos, "nombre");
  const descripcion = campo(datos, "descripcion");

  if (!Number.isInteger(presupuestoId) || presupuestoId <= 0) {
    return { ok: false, mensaje: "No sé de qué presupuesto quieres hacer la plantilla." };
  }
  if (nombre.length < 3) return { ok: false, mensaje: "Ponle un nombre, como «Baño completo»." };
  if (descripcion.length < 10) {
    return {
      ok: false,
      mensaje: "Describe para qué obra sirve: es lo que leerás dentro de seis meses.",
    };
  }

  const repetido = await db.select({ id: plantilla.id }).from(plantilla).where(eq(plantilla.nombre, nombre)).get();
  if (repetido) return { ok: false, mensaje: `Ya tienes una plantilla que se llama «${nombre}».` };

  const lineas = await lineasComoPlantilla(presupuestoId);
  if (lineas.length === 0) {
    return { ok: false, mensaje: "Ese presupuesto no tiene líneas: no hay nada que guardar." };
  }

  const { id } = await db
    .insert(plantilla)
    .values({ nombre, descripcion, lineas: JSON.stringify(lineas), creadoEn: ahora() })
    .returning({ id: plantilla.id })
    .get();

  revalidatePath("/panel/plantillas");
  redirect(`/panel/plantillas/${id}`);
}

/* ------------------------------------------------------------------ borrar */

export async function borrarPlantilla(id: number): Promise<Resultado> {
  await exigirSesion();
  const ficha = await db.select({ nombre: plantilla.nombre }).from(plantilla).where(eq(plantilla.id, id)).get();
  if (!ficha) return { ok: false, mensaje: "Esa plantilla ya no existe." };

  await db.delete(plantilla).where(eq(plantilla.id, id)).run();
  revalidatePath("/panel/plantillas");
  return { ok: true, mensaje: `Plantilla «${ficha.nombre}» borrada.` };
}
