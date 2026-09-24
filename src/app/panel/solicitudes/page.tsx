// Solicitudes: la bandeja de entrada. Se llena por dos sitios: la visita que
// Manolo dicta o pega (con lo que la máquina ha entendido) y el formulario de
// la web, que llega sin visita y sin mediciones.
import Link from "next/link";
import { FilePlusIcon, InboxIcon } from "lucide-react";
import { cn } from "cn";
import { desc } from "drizzle-orm";
import { db, solicitud } from "@/db";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TarjetaDeSolicitud, type SolicitudEnBandeja } from "@/components/solicitudes/tarjeta";
import { Button } from "@/components/ui/button";
import { formatoRelativo } from "@/lib/formato";
import { ahora, cargarReloj } from "@/lib/reloj";
import type { ConceptoCrudo } from "@/lib/tipos";

export const dynamic = "force-dynamic";

const FILTROS = [
  { clave: "pendiente", etiqueta: "Pendientes" },
  { clave: "convertida", etiqueta: "Convertidas" },
  { clave: "descartada", etiqueta: "Descartadas" },
] as const;

export default async function Solicitudes({ searchParams }: PageProps<"/panel/solicitudes">) {
  const { estado } = await searchParams;
  const filtro = FILTROS.some((f) => f.clave === estado) ? String(estado) : "pendiente";

  await cargarReloj();
  const todas = await db.select().from(solicitud).orderBy(desc(solicitud.creadoEn)).all();
  const hoy = ahora();
  const cuantas = (clave: string) => todas.filter((s) => s.estado === clave).length;

  const lista: SolicitudEnBandeja[] = todas
    .filter((s) => s.estado === filtro)
    .map((s) => ({
      id: s.id,
      clienteNombre: s.clienteNombre,
      telefono: s.telefono,
      email: s.email,
      direccion: s.direccion,
      titulo: s.titulo,
      urgencia: s.urgencia,
      textoOriginal: s.textoOriginal,
      conceptos: leerConceptos(s.conceptos),
      estado: s.estado,
      origen: s.origen === "cliente" ? "cliente" : "manolo",
      presupuestoId: s.presupuestoId,
      cuando: formatoRelativo(s.creadoEn, hoy),
    }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader
        titulo="Solicitudes"
        subtitulo="Cada visita que dictas y cada petición que llega desde la web caen aquí, listas para convertirse en presupuesto."
        acciones={
          <Button nativeButton={false} render={<Link href="/panel/nueva-visita" />}>
            <FilePlusIcon data-icon="inline-start" />
            Nueva Solicitud
          </Button>
        }
      />

      <nav className="flex flex-wrap items-center gap-1 border-b">
        {FILTROS.map((f) => {
          const activo = f.clave === filtro;
          const n = cuantas(f.clave);
          return (
            <Link
              key={f.clave}
              href={`/panel/solicitudes?estado=${f.clave}`}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                activo
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {f.etiqueta}
              <span
                className={cn(
                  "cifra rounded-sm px-1 text-[11px]",
                  activo ? "bg-enviado-fondo text-enviado" : "bg-secondary text-muted-foreground",
                )}
              >
                {n}
              </span>
            </Link>
          );
        })}
      </nav>

      {lista.length === 0 ? (
        <EmptyState
          icono={InboxIcon}
          titulo={vacio(filtro).titulo}
          texto={vacio(filtro).texto}
          accion={
            filtro === "pendiente" ? (
              <Button nativeButton={false} render={<Link href="/panel/nueva-visita" />}>
                <FilePlusIcon data-icon="inline-start" />
                Nueva Solicitud
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {lista.map((s) => (
            <TarjetaDeSolicitud key={s.id} solicitud={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function leerConceptos(json: string): ConceptoCrudo[] {
  try {
    const conceptos = JSON.parse(json) as ConceptoCrudo[];
    return Array.isArray(conceptos) ? conceptos : [];
  } catch {
    return [];
  }
}

function vacio(filtro: string): { titulo: string; texto: string } {
  if (filtro === "convertida") {
    return {
      titulo: "Todavía No Has Convertido Ninguna Visita",
      texto: "Cuando conviertas una solicitud en presupuesto, se quedará aquí con el enlace a su ficha.",
    };
  }
  if (filtro === "descartada") {
    return {
      titulo: "No Has Descartado Ninguna Visita",
      texto: "Lo que descartes se guarda aquí por si te arrepientes: siempre puedes recuperarlo.",
    };
  }
  return {
    titulo: "La Bandeja Está Vacía",
    texto: "Dicta la visita al salir del piso y caerá aquí en unos segundos, con el cliente, la dirección y los conceptos ya entendidos. Lo que pidan desde la web también llega aquí.",
  };
}
