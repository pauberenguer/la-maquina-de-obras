// Las lecturas del panel. Todo lo que las páginas necesitan saber de la base
// pasa por aquí, para que nadie escriba la misma consulta dos veces.
//
// Todas son asíncronas. Las que dependen de la hora cargan el reloj por sí
// mismas: así da igual desde dónde se llamen.
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, ne, sql } from "drizzle-orm";
import {
  aviso,
  cliente,
  db,
  evento,
  eventoLectura,
  linea,
  negocio,
  partida,
  plantilla,
  presupuesto,
  solicitud,
  tareaProgramada,
} from "@/db";
import { ahora, cargarReloj, inicioDelDia, UN_DIA } from "./reloj";
import { ESTADOS_VIVOS, type Estado } from "./tipos";

export type Negocio = typeof negocio.$inferSelect;
export type Presupuesto = typeof presupuesto.$inferSelect;
export type Linea = typeof linea.$inferSelect;
export type Cliente = typeof cliente.$inferSelect;
export type Evento = typeof evento.$inferSelect;
export type Tarea = typeof tareaProgramada.$inferSelect;
export type Lectura = typeof eventoLectura.$inferSelect;
export type Partida = typeof partida.$inferSelect;
export type Plantilla = typeof plantilla.$inferSelect;
export type Solicitud = typeof solicitud.$inferSelect;

/** Los datos de la empresa y la configuración. Única fuente: nada hardcodeado. */
export async function elNegocio(): Promise<Negocio> {
  const fila = await db.select().from(negocio).limit(1).get();
  if (!fila) throw new Error("La base no está sembrada: ejecuta npm run reset");
  return fila;
}

export type PresupuestoConCliente = Presupuesto & {
  clienteNombre: string;
  clienteTelefono: string | null;
  clienteEmail: string | null;
};

const CON_CLIENTE = {
  presupuesto,
  clienteNombre: cliente.nombre,
  clienteTelefono: cliente.telefono,
  clienteEmail: cliente.email,
};

function aplanar(filas: { presupuesto: Presupuesto; clienteNombre: string; clienteTelefono: string | null; clienteEmail: string | null }[]): PresupuestoConCliente[] {
  return filas.map((f) => ({
    ...f.presupuesto,
    clienteNombre: f.clienteNombre,
    clienteTelefono: f.clienteTelefono,
    clienteEmail: f.clienteEmail,
  }));
}

/** Todos los presupuestos con su cliente, del más reciente al más antiguo. */
export async function todosLosPresupuestos(): Promise<PresupuestoConCliente[]> {
  const filas = await db
    .select(CON_CLIENTE)
    .from(presupuesto)
    .innerJoin(cliente, eq(presupuesto.clienteId, cliente.id))
    .orderBy(desc(presupuesto.creadoEn))
    .all();
  return aplanar(filas);
}

export async function presupuestoPorId(id: number): Promise<PresupuestoConCliente | null> {
  const fila = await db
    .select(CON_CLIENTE)
    .from(presupuesto)
    .innerJoin(cliente, eq(presupuesto.clienteId, cliente.id))
    .where(eq(presupuesto.id, id))
    .get();
  return fila ? aplanar([fila])[0] : null;
}

export async function presupuestoPorToken(token: string): Promise<PresupuestoConCliente | null> {
  const fila = await db
    .select(CON_CLIENTE)
    .from(presupuesto)
    .innerJoin(cliente, eq(presupuesto.clienteId, cliente.id))
    .where(eq(presupuesto.token, token))
    .get();
  return fila ? aplanar([fila])[0] : null;
}

export async function lineasDe(presupuestoId: number): Promise<Linea[]> {
  return db
    .select()
    .from(linea)
    .where(eq(linea.presupuestoId, presupuestoId))
    .orderBy(asc(linea.orden))
    .all();
}

export async function eventosDe(presupuestoId: number): Promise<Evento[]> {
  return db
    .select()
    .from(evento)
    .where(eq(evento.presupuestoId, presupuestoId))
    .orderBy(desc(evento.ts))
    .all();
}

export async function tareasDe(presupuestoId: number): Promise<Tarea[]> {
  return db
    .select()
    .from(tareaProgramada)
    .where(eq(tareaProgramada.presupuestoId, presupuestoId))
    .orderBy(asc(tareaProgramada.ejecutarEn))
    .all();
}

/** La próxima acción programada de un presupuesto, si queda alguna. */
export async function proximaTarea(presupuestoId: number): Promise<Tarea | null> {
  const fila = await db
    .select()
    .from(tareaProgramada)
    .where(
      and(eq(tareaProgramada.presupuestoId, presupuestoId), eq(tareaProgramada.estado, "pendiente")),
    )
    .orderBy(asc(tareaProgramada.ejecutarEn))
    .limit(1)
    .get();
  return fila ?? null;
}

export async function lecturasDe(presupuestoId: number): Promise<Lectura[]> {
  return db
    .select()
    .from(eventoLectura)
    .where(eq(eventoLectura.presupuestoId, presupuestoId))
    .orderBy(desc(eventoLectura.ts))
    .all();
}

/** Los presupuestos vivos: su € es el del pipeline. */
export async function presupuestosVivos(): Promise<PresupuestoConCliente[]> {
  const filas = await db
    .select(CON_CLIENTE)
    .from(presupuesto)
    .innerJoin(cliente, eq(presupuesto.clienteId, cliente.id))
    .where(inArray(presupuesto.estado, [...ESTADOS_VIVOS]))
    .orderBy(desc(presupuesto.total))
    .all();
  return aplanar(filas);
}

/**
 * Vivos sin señales del cliente desde hace más de 7 días: ni una apertura ni una
 * respuesta, y enviados hace 8 días o más. Es el número del badge del menú.
 */
export async function sinRespuesta(): Promise<PresupuestoConCliente[]> {
  await cargarReloj();
  const hoy = ahora().getTime();
  const hace7 = new Date(hoy - 7 * UN_DIA);
  const hace8 = new Date(hoy - 8 * UN_DIA);
  const ultimaLectura = db
    .select({
      presupuestoId: eventoLectura.presupuestoId,
      ts: sql<number>`max(${eventoLectura.ts})`.as("ultima"),
    })
    .from(eventoLectura)
    .groupBy(eventoLectura.presupuestoId)
    .as("ultimaLectura");

  const filas = await db
    .select({ ...CON_CLIENTE, ultima: ultimaLectura.ts })
    .from(presupuesto)
    .innerJoin(cliente, eq(presupuesto.clienteId, cliente.id))
    .leftJoin(ultimaLectura, eq(ultimaLectura.presupuestoId, presupuesto.id))
    .where(
      and(
        inArray(presupuesto.estado, [...ESTADOS_VIVOS]),
        lte(presupuesto.enviadoEn, hace8),
      ),
    )
    .orderBy(asc(presupuesto.enviadoEn))
    .all();

  return aplanar(
    filas.filter((f) => {
      if (f.ultima && Number(f.ultima) > hace7.getTime()) return false;
      const respondio = f.presupuesto.respondioEn;
      if (respondio && respondio.getTime() > hace7.getTime()) return false;
      return true;
    }),
  );
}

/** Cuántos presupuestos llevan más de 7 días sin respuesta. Va en el badge del menú. */
export async function cuantosSinRespuesta(): Promise<number> {
  return (await sinRespuesta()).length;
}

/* -------------------------------------------------------------------- HOY */

export type AperturaDeHoy = {
  presupuestoId: number;
  numero: string;
  titulo: string;
  clienteNombre: string;
  direccionObra: string;
  total: number;
  estado: Estado;
  visitaN: number;
  ciudad: string | null;
  pais: string | null;
  dispositivo: string | null;
  ts: Date;
};

/** Quién ha abierto qué hoy. */
export async function aperturasDeHoy(): Promise<AperturaDeHoy[]> {
  await cargarReloj();
  const desde = inicioDelDia();
  const filas = await db
    .select({
      presupuestoId: presupuesto.id,
      numero: presupuesto.numero,
      titulo: presupuesto.titulo,
      clienteNombre: cliente.nombre,
      direccionObra: presupuesto.direccionObra,
      total: presupuesto.total,
      estado: presupuesto.estado,
      visitaN: eventoLectura.visitaN,
      ciudad: eventoLectura.ciudad,
      pais: eventoLectura.pais,
      dispositivo: eventoLectura.dispositivo,
      ts: eventoLectura.ts,
    })
    .from(eventoLectura)
    .innerJoin(presupuesto, eq(eventoLectura.presupuestoId, presupuesto.id))
    .innerJoin(cliente, eq(presupuesto.clienteId, cliente.id))
    .where(and(isNull(eventoLectura.seccion), gte(eventoLectura.ts, desde)))
    .orderBy(desc(eventoLectura.ts))
    .all();
  return filas as AperturaDeHoy[];
}

export type SeguimientoDeHoy = Tarea & {
  numero: string;
  titulo: string;
  clienteNombre: string;
  total: number;
};

/** Los seguimientos que salen hoy. */
export async function seguimientosDeHoy(): Promise<SeguimientoDeHoy[]> {
  await cargarReloj();
  const desde = inicioDelDia();
  const hasta = new Date(desde.getTime() + UN_DIA);
  const filas = await db
    .select({
      tarea: tareaProgramada,
      numero: presupuesto.numero,
      titulo: presupuesto.titulo,
      clienteNombre: cliente.nombre,
      total: presupuesto.total,
    })
    .from(tareaProgramada)
    .innerJoin(presupuesto, eq(tareaProgramada.presupuestoId, presupuesto.id))
    .innerJoin(cliente, eq(presupuesto.clienteId, cliente.id))
    .where(
      and(
        eq(tareaProgramada.estado, "pendiente"),
        gte(tareaProgramada.ejecutarEn, desde),
        lt(tareaProgramada.ejecutarEn, hasta),
      ),
    )
    .orderBy(asc(tareaProgramada.ejecutarEn))
    .all();
  return filas.map((f) => ({
    ...f.tarea,
    numero: f.numero,
    titulo: f.titulo,
    clienteNombre: f.clienteNombre,
    total: f.total,
  }));
}

/** Los vivos que caducan en 3 días o menos. */
export async function caducanPronto(dias = 3): Promise<PresupuestoConCliente[]> {
  await cargarReloj();
  const hoy = ahora();
  const limite = new Date(inicioDelDia().getTime() + (dias + 1) * UN_DIA);
  const filas = await db
    .select(CON_CLIENTE)
    .from(presupuesto)
    .innerJoin(cliente, eq(presupuesto.clienteId, cliente.id))
    .where(
      and(
        inArray(presupuesto.estado, [...ESTADOS_VIVOS]),
        gte(presupuesto.validoHasta, hoy),
        lt(presupuesto.validoHasta, limite),
      ),
    )
    .orderBy(asc(presupuesto.validoHasta))
    .all();
  return aplanar(filas);
}

export type Reapertura = PresupuestoConCliente & { ultimaLectura: Date };

/** Caducados que alguien ha vuelto a abrir: señal de compra. */
export async function expiradosReabiertos(dias = 7): Promise<Reapertura[]> {
  await cargarReloj();
  const desde = new Date(ahora().getTime() - dias * UN_DIA);
  const filas = await db
    .select({ ...CON_CLIENTE, ts: eventoLectura.ts })
    .from(eventoLectura)
    .innerJoin(presupuesto, eq(eventoLectura.presupuestoId, presupuesto.id))
    .innerJoin(cliente, eq(presupuesto.clienteId, cliente.id))
    .where(
      and(isNull(eventoLectura.seccion), eq(presupuesto.estado, "expirado"), gte(eventoLectura.ts, desde)),
    )
    .orderBy(desc(eventoLectura.ts))
    .all();

  const vistos = new Set<number>();
  const resultado: Reapertura[] = [];
  for (const f of filas) {
    if (vistos.has(f.presupuesto.id)) continue;
    vistos.add(f.presupuesto.id);
    resultado.push({ ...aplanar([f])[0], ultimaLectura: f.ts });
  }
  return resultado;
}

/* ---------------------------------------------------------------- clientes */

export type ClienteConResumen = Cliente & {
  presupuestos: number;
  ganados: number;
  contratado: number;
  ultimoEn: Date | null;
};

export async function clientesConResumen(): Promise<ClienteConResumen[]> {
  const filas = await db
    .select({
      cliente,
      presupuestos: sql<number>`count(${presupuesto.id})`,
      ganados: sql<number>`sum(case when ${presupuesto.estado} = 'ganado' then 1 else 0 end)`,
      contratado: sql<number>`coalesce(sum(case when ${presupuesto.estado} = 'ganado' then ${presupuesto.total} else 0 end), 0)`,
      ultimoEn: sql<number | null>`max(${presupuesto.creadoEn})`,
    })
    .from(cliente)
    .leftJoin(presupuesto, eq(presupuesto.clienteId, cliente.id))
    .groupBy(cliente.id)
    .orderBy(desc(sql`coalesce(sum(case when ${presupuesto.estado} = 'ganado' then ${presupuesto.total} else 0 end), 0)`))
    .all();
  return filas.map((f) => ({
    ...f.cliente,
    presupuestos: Number(f.presupuestos ?? 0),
    ganados: Number(f.ganados ?? 0),
    contratado: Number(f.contratado ?? 0),
    ultimoEn: f.ultimoEn ? new Date(Number(f.ultimoEn)) : null,
  }));
}

export async function clientePorId(id: number): Promise<Cliente | null> {
  return (await db.select().from(cliente).where(eq(cliente.id, id)).get()) ?? null;
}

export async function presupuestosDeCliente(clienteId: number): Promise<PresupuestoConCliente[]> {
  const filas = await db
    .select(CON_CLIENTE)
    .from(presupuesto)
    .innerJoin(cliente, eq(presupuesto.clienteId, cliente.id))
    .where(eq(presupuesto.clienteId, clienteId))
    .orderBy(desc(presupuesto.creadoEn))
    .all();
  return aplanar(filas);
}

/* ------------------------------------------------- banco, plantillas, etc. */

export async function bancoDePrecios(soloActivas = false): Promise<Partida[]> {
  const consulta = db.select().from(partida);
  const filas = soloActivas ? await consulta.where(eq(partida.activa, true)).all() : await consulta.all();
  return filas.sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export async function plantillas(): Promise<Plantilla[]> {
  return db.select().from(plantilla).orderBy(asc(plantilla.nombre)).all();
}

export async function solicitudesPendientes(): Promise<Solicitud[]> {
  return db
    .select()
    .from(solicitud)
    .where(eq(solicitud.estado, "pendiente"))
    .orderBy(desc(solicitud.creadoEn))
    .all();
}

export async function cuantasSolicitudesPendientes(): Promise<number> {
  const fila = await db
    .select({ n: sql<number>`count(*)` })
    .from(solicitud)
    .where(eq(solicitud.estado, "pendiente"))
    .get();
  return Number(fila?.n ?? 0);
}

/** El último movimiento de la base: el polling compara este número. */
export async function versionDelPanel(): Promise<number> {
  const [ultimoEvento, ultimoAviso, sinLeer] = await Promise.all([
    db.select({ ts: sql<number>`max(${evento.ts})` }).from(evento).get(),
    db.select({ ts: sql<number>`max(${aviso.ts})` }).from(aviso).get(),
    db.select({ n: sql<number>`count(*)` }).from(aviso).where(eq(aviso.leido, false)).get(),
  ]);
  return (
    Math.max(Number(ultimoEvento?.ts ?? 0), Number(ultimoAviso?.ts ?? 0)) + Number(sinLeer?.n ?? 0)
  );
}

export { ne };

/* -------------------------------------------------------------- la web */

export type CapituloDeLaWeb = { nombre: string; partidas: number; ejemplos: string[] };

export type DatosDeLaWeb = {
  negocio: Negocio;
  capitulos: CapituloDeLaWeb[];
  obrasContratadas: number;
  clientes: number;
  partidas: number;
};

/**
 * Lo que enseña la landing, sacado entero de la base: si Manolo cambia sus
 * datos en Ajustes o su banco de precios, la web cambia con ellos. Los
 * capítulos van en el orden del banco, que es el orden en que se hace la obra.
 */
export async function datosDeLaWeb(): Promise<DatosDeLaWeb> {
  const [negocioFila, activas, contratadas, clientes] = await Promise.all([
    elNegocio(),
    db.select().from(partida).where(eq(partida.activa, true)).orderBy(asc(partida.id)).all(),
    db.select({ n: sql<number>`count(*)` }).from(presupuesto).where(eq(presupuesto.estado, "ganado")).get(),
    db.select({ n: sql<number>`count(*)` }).from(cliente).get(),
  ]);

  const porCapitulo = new Map<string, CapituloDeLaWeb>();
  for (const p of activas) {
    const capitulo = porCapitulo.get(p.capitulo) ?? { nombre: p.capitulo, partidas: 0, ejemplos: [] };
    capitulo.partidas++;
    if (capitulo.ejemplos.length < 3) capitulo.ejemplos.push(p.nombre);
    porCapitulo.set(p.capitulo, capitulo);
  }

  return {
    negocio: negocioFila,
    capitulos: [...porCapitulo.values()],
    obrasContratadas: Number(contratadas?.n ?? 0),
    clientes: Number(clientes?.n ?? 0),
    partidas: activas.length,
  };
}

/**
 * Cuántas entradas enseña la pestaña Actividad: los eventos más los avisos que
 * no repiten lo que ya cuenta un evento de su mismo instante. Es el número del
 * badge de la pestaña, y tiene que cuadrar con lo que se ve dentro.
 */
export async function cuantasEntradasDeActividad(presupuestoId: number, margenMs = 4000): Promise<number> {
  const [eventos, avisos] = await Promise.all([
    db.select({ ts: evento.ts }).from(evento).where(eq(evento.presupuestoId, presupuestoId)).all(),
    db.select({ ts: aviso.ts }).from(aviso).where(eq(aviso.presupuestoId, presupuestoId)).all(),
  ]);
  const instantes = eventos.map((e) => e.ts.getTime());
  const sueltos = avisos.filter(
    (a) => !instantes.some((t) => Math.abs(t - a.ts.getTime()) <= margenMs),
  ).length;
  return instantes.length + sueltos;
}
