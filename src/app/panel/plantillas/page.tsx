// Plantillas: los presupuestos tipo de Reformas Soler. Las obras de siempre,
// con sus líneas ya puestas, para arrancar en dos clics y ajustar mediciones.
import { LayoutTemplateIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TarjetaDePlantilla, type PlantillaEnPantalla } from "@/components/plantillas/tarjeta";
import { resumirPlantilla } from "@/components/plantillas/resumen";
import { elNegocio, plantillas } from "@/lib/consultas";

export const dynamic = "force-dynamic";

export default async function Plantillas() {
  const [negocio, todas] = await Promise.all([elNegocio(), plantillas()]);
  const lista: PlantillaEnPantalla[] = await Promise.all(
    todas.map(async (p) => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      ...(await resumirPlantilla(p.id, negocio.ivaPct)),
    })),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader
        titulo="Plantillas"
        subtitulo="Presupuestos tipo para las obras de siempre. El importe es orientativo, con los precios de hoy del banco: en cada obra se ajustan las mediciones."
      />

      {lista.length === 0 ? (
        <EmptyState
          icono={LayoutTemplateIcon}
          titulo="Todavía No Tienes Ninguna Plantilla"
          texto="Las plantillas nacen de un presupuesto que ya has hecho: abre uno, dale a «Guardar como plantilla» y lo tendrás aquí para la próxima obra igual."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lista.map((p) => (
            <TarjetaDePlantilla key={p.id} plantilla={p} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        ¿Te falta una? Abre cualquier presupuesto y guárdalo como plantilla: se copian sus líneas,
        sus unidades y sus mediciones.
      </p>
    </div>
  );
}
