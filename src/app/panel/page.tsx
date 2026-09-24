// Inicio: lo que hay que atender hoy, y los euros reales del negocio.
import { Hoy } from "@/components/inicio/hoy";
import { Kpi } from "@/components/kpi";
import { PageHeader } from "@/components/page-header";
import { elNegocio } from "@/lib/consultas";
import { formatoFecha } from "@/lib/formato";
import { losNumeros } from "@/lib/metricas";
import { ahora, cargarReloj } from "@/lib/reloj";

export const dynamic = "force-dynamic";

function saludo(fecha: Date): string {
  const hora = Number(
    new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false })
      .format(fecha)
      .replace("24", "0"),
  );
  if (hora < 6) return "Buenas Noches";
  if (hora < 14) return "Buenos Días";
  if (hora < 21) return "Buenas Tardes";
  return "Buenas Noches";
}

export default async function Inicio() {
  await cargarReloj();
  const [negocio, metricas] = await Promise.all([elNegocio(), losNumeros()]);
  const hoy = ahora();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        titulo={`${saludo(hoy)}, Manolo`}
        subtitulo={
          <>
            {formatoFecha(hoy)} · {negocio.nombre}
          </>
        }
      />

      <Hoy />

      <section className="overflow-hidden rounded-xl border bg-card">
        <header className="flex items-baseline justify-between gap-3 border-b px-5 py-3.5">
          <h2 className="font-semibold">Los Números</h2>
          <span className="text-xs text-muted-foreground">
            sumas de presupuestos reales, nunca estimaciones
          </span>
        </header>
        <div className="grid divide-y sm:grid-cols-2 sm:divide-x lg:grid-cols-3">
          {metricas.map((metrica) => (
            <Kpi key={metrica.clave} metrica={metrica} />
          ))}
        </div>
      </section>
    </div>
  );
}
