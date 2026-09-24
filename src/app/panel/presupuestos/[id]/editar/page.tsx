// El editor del presupuesto. Solo se entra si sigue siendo un Borrador: en
// cuanto está enviado, el documento es el que vio el cliente y no se toca.
import { notFound, redirect } from "next/navigation";
import { Editor } from "@/components/editor/editor";
import type { LineaEditable, PartidaBanco } from "@/components/editor/tipos";
import { bancoDePrecios, elNegocio, lineasDe, presupuestoPorId } from "@/lib/consultas";
import type { Unidad } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function EditarPresupuesto({ params }: PageProps<"/panel/presupuestos/[id]/editar">) {
  const { id } = await params;
  const presupuesto = await presupuestoPorId(Number(id));
  if (!presupuesto) notFound();
  if (presupuesto.estado !== "borrador") redirect(`/panel/presupuestos/${presupuesto.id}`);

  const [negocio, banco, filas] = await Promise.all([
    elNegocio(),
    bancoDePrecios(),
    lineasDe(presupuesto.id),
  ]);
  const objetivoPorPartida = new Map(banco.map((p) => [p.id, p.margenObjetivo]));

  const lineas: LineaEditable[] = filas.map((l) => ({
    id: l.id,
    partidaId: l.partidaId,
    capitulo: l.capitulo,
    descripcion: l.descripcion,
    unidad: l.unidad as Unidad,
    medicion: l.medicion,
    precio: l.precio,
    precioManual: l.precioManual,
    margenPct: l.margenPct,
    margenObjetivo:
      l.partidaId !== null ? (objetivoPorPartida.get(l.partidaId) ?? l.margenPct) : l.margenPct,
    total: l.total,
    amarilla: l.amarilla,
    opcional: l.opcional,
    elegida: l.elegida,
    orden: l.orden,
    confianza: l.confianza,
    motivoIa: l.motivoIa,
  }));

  const activas: PartidaBanco[] = banco
    .filter((p) => p.activa)
    .map((p) => ({
      id: p.id,
      codigo: p.codigo,
      capitulo: p.capitulo,
      nombre: p.nombre,
      unidad: p.unidad as Unidad,
      precio: p.precio,
      margenObjetivo: p.margenObjetivo,
    }));

  const capitulos = [...new Set(banco.map((p) => p.capitulo))];

  return (
    <Editor
      presupuestoId={presupuesto.id}
      numero={presupuesto.numero}
      clienteNombre={presupuesto.clienteNombre}
      tituloInicial={presupuesto.titulo}
      direccionInicial={presupuesto.direccionObra}
      ivaPct={presupuesto.ivaPct || negocio.ivaPct}
      caducidadInicial={presupuesto.caducidadDias}
      descuentoInicial={presupuesto.descuentoPct}
      lineasIniciales={lineas}
      banco={activas}
      capitulos={capitulos}
    />
  );
}
