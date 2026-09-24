// «+ Nueva Solicitud»: el minuto en el que Manolo sale del piso y cuenta lo que
// ha visto, dictando o escribiendo. De aquí sale la solicitud, y de la
// solicitud el presupuesto.
import { PageHeader } from "@/components/page-header";
import { FormularioDeVisita } from "@/components/visita/formulario";
import { hayIa } from "@/lib/ia";

export const dynamic = "force-dynamic";

export default function NuevaVisita() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        titulo="Nueva Solicitud"
        subtitulo="Al salir del piso cuentas lo que has visto —dictando o escribiendo— y la máquina lo convierte en presupuesto."
      />
      <FormularioDeVisita conIa={hayIa()} />
    </div>
  );
}
