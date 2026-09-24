// La página del cliente: el presupuesto por un enlace que no se adivina.
//
// Fuera del layout del panel: aquí no hay barra lateral, ni menú, ni un solo
// enlace de vuelta al producto. Primero móvil, porque ahí se abre.
//
// DUEÑO: carril B2.
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Rastreador } from "@/components/rastreador";
import type { DatosPublicos, LineaPublica } from "@/components/publico/datos";
import { PaginaPublica } from "@/components/publico/pagina";
import { elNegocio, lineasDe, presupuestoPorToken } from "@/lib/consultas";
import {
  formatoDiasRestantes,
  formatoDispositivo,
  formatoFecha,
  formatoHora,
  formatoTitulo,
} from "@/lib/formato";
import { ahora, cargarReloj } from "@/lib/reloj";
import type { Estado, Unidad } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({
  params,
}: PageProps<"/p/[token]">): Promise<Metadata> {
  const { token } = await params;
  const presupuesto = await presupuestoPorToken(token);
  if (!presupuesto || presupuesto.estado === "borrador") {
    return { title: "Presupuesto no disponible · Reformas Soler" };
  }
  return {
    title: `Presupuesto ${presupuesto.numero} · ${formatoTitulo(presupuesto.titulo)} · Reformas Soler`,
    description: `Presupuesto de Reformas Soler para ${presupuesto.direccionObra}.`,
    robots: { index: false, follow: false },
  };
}

export default async function PaginaDelCliente({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const presupuesto = await presupuestoPorToken(token);
  // Un borrador todavía no tiene página: el enlace nace al enviarlo.
  if (!presupuesto || presupuesto.estado === "borrador") notFound();

  const [negocio, filas] = await Promise.all([elNegocio(), lineasDe(presupuesto.id), cargarReloj()]);
  const hoy = ahora();
  const caducado = presupuesto.validoHasta
    ? presupuesto.validoHasta.getTime() < hoy.getTime()
    : false;
  const cerrado =
    presupuesto.estado === "ganado" ||
    presupuesto.estado === "perdido" ||
    presupuesto.estado === "expirado";

  const lineas: LineaPublica[] = filas.map((l) => ({
    id: l.id,
    capitulo: l.capitulo,
    descripcion: l.descripcion,
    unidad: l.unidad as Unidad,
    medicion: l.medicion,
    precio: l.precio,
    total: l.total,
    opcional: l.opcional,
    elegida: l.elegida,
  }));

  const datos: DatosPublicos = {
    token: presupuesto.token,
    numero: presupuesto.numero,
    titulo: presupuesto.titulo,
    estado: presupuesto.estado as Estado,
    direccionObra: presupuesto.direccionObra,
    clienteNombre: presupuesto.clienteNombre,
    empresa: {
      nombre: negocio.nombre,
      cif: negocio.cif,
      direccion: negocio.direccion,
      telefono: negocio.telefono,
      email: negocio.email,
    },
    ivaPct: presupuesto.ivaPct,
    descuentoPct: presupuesto.descuentoPct,
    condiciones: negocio.condiciones,
    lineas,
    fechaDocumento: formatoFecha(presupuesto.enviadoEn ?? presupuesto.creadoEn),
    validoHasta: presupuesto.validoHasta ? formatoFecha(presupuesto.validoHasta) : null,
    diasRestantes:
      presupuesto.validoHasta && !caducado
        ? formatoDiasRestantes(presupuesto.validoHasta, hoy)
        : null,
    caducado,
    cerrado,
    abierto: !caducado && !cerrado,
    respondido: presupuesto.respondioEn != null,
    firma: presupuesto.firmaPng
      ? {
          fecha: formatoFecha(presupuesto.firmadoEn),
          hora: formatoHora(presupuesto.firmadoEn),
          ip: presupuesto.firmaIp,
          dispositivo: presupuesto.firmaDispositivo
            ? formatoDispositivo(presupuesto.firmaDispositivo)
            : null,
          png: presupuesto.firmaPng,
        }
      : null,
  };

  return (
    <>
      <PaginaPublica datos={datos} />
      <Rastreador token={presupuesto.token} />
    </>
  );
}
