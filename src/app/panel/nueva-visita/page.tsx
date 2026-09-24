// «+ Nueva Solicitud»: Manolo cuenta la visita, dictando o escribiendo. Llega en
// la fase 1.
import { FilePlusIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function NuevaSolicitud() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        titulo="Nueva Solicitud"
        subtitulo="Al salir del piso cuentas lo que has visto —dictando o escribiendo— y la máquina lo convierte en presupuesto."
      />
      <EmptyState
        icono={FilePlusIcon}
        titulo="La Entrada de Solicitudes Llega en la Fase 1"
        texto="Aquí dictarás la visita y verás el texto aparecer en pantalla, o pegarás tus notas escritas. Al guardar, la solicitud cae en la bandeja con los conceptos ya entendidos."
      />
    </div>
  );
}
