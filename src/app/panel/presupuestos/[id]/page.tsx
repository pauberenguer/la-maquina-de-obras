// La ficha del presupuesto: el documento a la izquierda y, a la derecha, el
// panel con General, Actividad y Seguimientos.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { EstadoBadge } from "@/components/estado-badge";
import { Importe } from "@/components/importe";
import { Actividad } from "@/components/presupuesto/actividad";
import { AccionesDelPresupuesto } from "@/components/presupuesto/acciones";
import { Documento } from "@/components/presupuesto/documento";
import { EnlacePublico } from "@/components/presupuesto/enlace-publico";
import { PanelDelPresupuesto } from "@/components/presupuesto/panel";
import { Seguimientos } from "@/components/presupuesto/seguimientos";
import {
  cuantasEntradasDeActividad,
  elNegocio,
  lineasDe,
  presupuestoPorId,
} from "@/lib/consultas";
import {
  formatoDiasRestantes,
  formatoFecha,
  formatoPorcentaje,
  formatoRelativo,
  formatoTitulo,
} from "@/lib/formato";
import { ahora, cargarReloj } from "@/lib/reloj";
import { urlDeLaApp } from "@/lib/telegram";
import type { Estado } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function FichaDelPresupuesto({ params }: PageProps<"/panel/presupuestos/[id]">) {
  const { id } = await params;
  await cargarReloj();
  const presupuesto = await presupuestoPorId(Number(id));
  if (!presupuesto) notFound();

  const [negocio, lineas, cuantosEventos] = await Promise.all([
    elNegocio(),
    lineasDe(presupuesto.id),
    cuantasEntradasDeActividad(presupuesto.id),
  ]);
  const hoy = ahora();
  const url = `${urlDeLaApp()}/p/${presupuesto.token}`;
  const amarillas = lineas.filter((l) => l.amarilla).length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/panel/presupuestos"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3" />
            Presupuestos
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-[22px] leading-7 font-semibold tracking-tight">
            {presupuesto.clienteNombre}
            <EstadoBadge estado={presupuesto.estado as Estado} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="cifra">{presupuesto.numero}</span> · {formatoTitulo(presupuesto.titulo)} ·{" "}
            {presupuesto.direccionObra}
          </p>
        </div>
        <div className="text-right">
          <Importe centimos={presupuesto.total} className="text-[26px] leading-8 font-semibold" />
          <p className="text-xs text-muted-foreground">
            margen {formatoPorcentaje(presupuesto.margenPct, 0)}
            {presupuesto.validoHasta && (
              <> · válido hasta el {formatoFecha(presupuesto.validoHasta)}</>
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Documento negocio={negocio} presupuesto={presupuesto} lineas={lineas} />

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border bg-card p-4">
            <PanelDelPresupuesto
              cuantosEventos={cuantosEventos}
              general={
                <div className="space-y-4">
                  <dl className="space-y-2 text-sm">
                    <Par etiqueta="Total" valor={<Importe centimos={presupuesto.total} />} />
                    <Par etiqueta="Base Imponible" valor={<Importe centimos={presupuesto.base} />} />
                    <Par
                      etiqueta="Coste Estimado"
                      valor={<Importe centimos={presupuesto.coste} tono="apagado" />}
                    />
                    <Par etiqueta="Margen" valor={formatoPorcentaje(presupuesto.margenPct, 1)} />
                    <Par etiqueta="Número" valor={presupuesto.numero} />
                    <Par etiqueta="Visita" valor={formatoFecha(presupuesto.visitaEn)} />
                    <Par
                      etiqueta="Enviado"
                      valor={
                        presupuesto.enviadoEn
                          ? `${formatoFecha(presupuesto.enviadoEn)} · ${formatoRelativo(presupuesto.enviadoEn, hoy)}`
                          : "todavía no"
                      }
                    />
                    <Par
                      etiqueta="Válido hasta"
                      valor={
                        presupuesto.validoHasta
                          ? `${formatoFecha(presupuesto.validoHasta)} · ${formatoDiasRestantes(presupuesto.validoHasta, hoy)}`
                          : `${presupuesto.caducidadDias} días desde el envío`
                      }
                    />
                    {presupuesto.motivoPerdido && (
                      <Par etiqueta="Motivo" valor={presupuesto.motivoPerdido} />
                    )}
                    {presupuesto.firmadoEn && (
                      <Par
                        etiqueta="Firmado"
                        valor={`${formatoFecha(presupuesto.firmadoEn)} · ${presupuesto.firmaIp ?? ""}`}
                      />
                    )}
                    {amarillas > 0 && (
                      <Par
                        etiqueta="Fuera del Banco"
                        valor={
                          <span className="rounded-sm bg-amarilla-fondo px-1.5 py-0.5 text-xs font-medium text-conversacion">
                            {amarillas} {amarillas === 1 ? "línea" : "líneas"} sin precio
                          </span>
                        }
                      />
                    )}
                  </dl>

                  {presupuesto.enviadoEn && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Enlace del Cliente
                      </p>
                      <EnlacePublico url={url} />
                    </div>
                  )}

                  {presupuesto.respuestaTexto && (
                    <div className="rounded-lg border border-conversacion/30 bg-conversacion-fondo/60 px-3 py-2.5">
                      <p className="text-xs font-medium tracking-wide text-conversacion uppercase">
                        El cliente ha escrito
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">{presupuesto.respuestaTexto}</p>
                    </div>
                  )}

                  <AccionesDelPresupuesto presupuesto={presupuesto} amarillas={amarillas} />
                </div>
              }
              actividad={<Actividad presupuestoId={presupuesto.id} />}
              seguimientos={<Seguimientos presupuestoId={presupuesto.id} />}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Par({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 text-right font-medium">{valor}</dd>
    </div>
  );
}
