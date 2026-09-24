// Pedir presupuesto: la puerta de la calle. El cliente cuenta qué quiere hacer y
// Manolo le llama para ir a verlo, porque sin ver la obra no hay presupuesto.
import type { Metadata } from "next";
import { CabeceraWeb } from "@/components/web/cabecera";
import { FormularioSolicitud } from "@/components/web/formulario-solicitud";
import { PieWeb } from "@/components/web/pie";
import { elNegocio } from "@/lib/consultas";
import { ahora, cargarReloj } from "@/lib/reloj";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pedir Presupuesto · Reformas Soler",
  description: "Cuéntanos qué obra quieres hacer y te llamamos para ir a verla.",
};

const PASOS = [
  "Te llamamos para concertar una visita.",
  "Vamos a ver la obra y la medimos.",
  "Al día siguiente tienes el presupuesto, partida por partida.",
];

export default async function Solicitar() {
  await cargarReloj();
  const negocio = await elNegocio();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CabeceraWeb telefono={negocio.telefono} conBoton={false} />

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:py-16">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pide Tu Presupuesto</h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Cuéntanos qué quieres hacer y Manolo te llama. Sin ver la obra no damos precios, porque
            cada casa es distinta: por eso lo primero es la visita.
          </p>
          <ol className="mt-8 space-y-4">
            {PASOS.map((paso, i) => (
              <li key={paso} className="flex items-start gap-3">
                <span className="cifra flex size-7 shrink-0 items-center justify-center rounded-full bg-marca text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-sm leading-relaxed">{paso}</span>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm text-muted-foreground">
            ¿Prefieres llamar? Estamos en el{" "}
            <a
              href={`tel:${negocio.telefono.replace(/\s/g, "")}`}
              className="cifra font-medium text-foreground hover:underline"
            >
              {negocio.telefono}
            </a>
            .
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 sm:p-7">
          <FormularioSolicitud />
        </div>
      </main>

      <PieWeb negocio={negocio} anyo={ahora().getFullYear()} />
    </div>
  );
}
