// Ajustes: la única fuente de configuración del producto.
import { InfoIcon } from "lucide-react";
import { FormularioAjustes } from "@/components/ajustes/formulario";
import { PageHeader } from "@/components/page-header";
import { elNegocio } from "@/lib/consultas";
import { formatoFecha } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Ajustes() {
  const negocio = await elNegocio();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        titulo="Ajustes"
        subtitulo="Lo que cambies aquí manda en todos los presupuestos: la cabecera, el IVA, la caducidad y los seguimientos."
      />

      <FormularioAjustes
        valores={{
          nombre: negocio.nombre,
          cif: negocio.cif,
          direccion: negocio.direccion,
          telefono: negocio.telefono,
          email: negocio.email,
          colorMarca: negocio.colorMarca,
          ivaPct: negocio.ivaPct,
          caducidadDias: negocio.caducidadDias,
          condiciones: negocio.condiciones,
          seguimiento1: negocio.seguimiento1,
          seguimiento2: negocio.seguimiento2,
          seguimiento3: negocio.seguimiento3,
        }}
      />

      {negocio.datosEjemplo && (
        <p className="flex items-start gap-2 rounded-lg border bg-card px-4 py-3 text-xs text-muted-foreground">
          <InfoIcon className="mt-px size-4 shrink-0" />
          <span>
            Esta base está cargada con datos de ejemplo: los clientes, los presupuestos y las
            lecturas son inventados para poder enseñar el producto. El banco de precios sí es el de
            Reformas Soler. Manolo empezó a usar la máquina el {formatoFecha(negocio.fechaAlta)}; lo
            anterior a esa fecha es historial importado.
          </span>
        </p>
      )}
    </div>
  );
}
