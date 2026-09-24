// Plantillas: presupuestos tipo. Ver sus líneas, crear desde plantilla y guardar
// como plantilla llegan en la fase 4.
import { LayoutTemplateIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { plantillas } from "@/lib/consultas";
import { formatoTitulo } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Plantillas() {
  const lista = await plantillas();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader
        titulo="Plantillas"
        subtitulo="Presupuestos tipo para las obras de siempre: se crean con dos clics y se ajustan las mediciones."
      />
      <EmptyState
        icono={LayoutTemplateIcon}
        titulo={`${lista.length} Plantillas Listas: ${lista.map((p) => formatoTitulo(p.nombre)).join(", ")}`}
        texto="Ver sus líneas, crear un presupuesto desde una plantilla y guardar cualquier presupuesto como plantilla llegan en la fase 4."
      />
    </div>
  );
}
