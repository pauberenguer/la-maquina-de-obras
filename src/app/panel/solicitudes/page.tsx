// Solicitudes: la bandeja de entrada. Se llena por dos sitios: la visita que
// dicta o pega Manolo y el formulario público de /solicitar. La lista y el botón
// «Convertir en Presupuesto» llegan en la fase 1.
import { InboxIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { cuantasSolicitudesPendientes } from "@/lib/consultas";

export const dynamic = "force-dynamic";

export default async function Solicitudes() {
  const pendientes = await cuantasSolicitudesPendientes();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader
        titulo="Solicitudes"
        subtitulo="Cada visita que dictas y cada petición que llega desde la web caen aquí, listas para convertirse en presupuesto."
      />
      <EmptyState
        icono={InboxIcon}
        titulo={
          pendientes === 1
            ? "Hay 1 Solicitud Esperando"
            : `Hay ${pendientes} Solicitudes Esperando`
        }
        texto="La bandeja con el cliente, la dirección, la urgencia y los conceptos que ha entendido la máquina se enciende en la fase 1, junto con «+ Nueva Solicitud» y el formulario de la web."
      />
    </div>
  );
}
