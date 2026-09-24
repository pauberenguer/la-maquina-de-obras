// Precios: el banco de precios de Reformas Soler. La edición en línea, el alta y
// baja de partidas y la importación de CSV llegan en la fase 2.
import { TagsIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { bancoDePrecios } from "@/lib/consultas";

export const dynamic = "force-dynamic";

export default async function Precios() {
  const partidas = await bancoDePrecios();
  const capitulos = new Set(partidas.map((p) => p.capitulo));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <PageHeader
        titulo="Precios"
        subtitulo={`${partidas.length} partidas en ${capitulos.size} capítulos. Es la prueba de que el sistema no inventa precios: solo existen estos y los que escribas a mano.`}
      />
      <EmptyState
        icono={TagsIcon}
        titulo="El Banco Ya Está Cargado"
        texto={`Las ${partidas.length} partidas están en la base y el editor de presupuestos ya tira de ellas. El buscador por capítulos, la edición de precio y margen, el alta y baja y la reimportación del CSV llegan en la fase 2.`}
      />
    </div>
  );
}
