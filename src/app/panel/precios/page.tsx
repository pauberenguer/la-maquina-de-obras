// Precios: el banco de precios de Reformas Soler. Buscador, edición en línea de
// precio y margen, alta y baja de partidas, activar y desactivar e importar CSV.
//
// Es la prueba de que el sistema no inventa precios: en un presupuesto solo
// pueden entrar los precios de esta tabla o los que Manolo escriba a mano.
import { PageHeader } from "@/components/page-header";
import { AccionesDelBanco } from "@/components/precios/acciones-banco";
import { BancoDePrecios, type PartidaEnPantalla } from "@/components/precios/banco";
import { bancoDePrecios } from "@/lib/consultas";

export const dynamic = "force-dynamic";

export default async function Precios() {
  const partidas = await bancoDePrecios();
  const capitulos = [...new Set(partidas.map((p) => p.capitulo))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  const enPantalla: PartidaEnPantalla[] = partidas.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    capitulo: p.capitulo,
    nombre: p.nombre,
    unidad: p.unidad,
    precio: p.precio,
    margenObjetivo: p.margenObjetivo,
    activa: p.activa,
  }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <PageHeader
        titulo="Precios"
        subtitulo={
          <>
            {partidas.length} partidas en {capitulos.length} capítulos. Es la prueba de que el
            sistema no inventa precios: en un presupuesto solo entran estos precios o los que
            escribas tú a mano.
          </>
        }
        acciones={<AccionesDelBanco capitulos={capitulos} />}
      />
      <BancoDePrecios partidas={enPantalla} />
    </div>
  );
}
