// El marco del panel: barra lateral, barra del reloj de la demo y el contenido.
// Todo lo que cuelga de /panel es privado: src/proxy.ts corta la puerta, y este
// layout vuelve a comprobar la sesión por si acaso. La web pública y la página
// del presupuesto viven fuera de este layout.
import { Toaster } from "@/components/ui/sonner";
import { BarraReloj } from "@/components/barra-reloj";
import { Pulso } from "@/components/pulso";
import { Sidebar } from "@/components/sidebar";
import { ultimosAvisos, avisosSinLeer } from "@/lib/avisos";
import { cuantasSolicitudesPendientes, cuantosSinRespuesta, elNegocio } from "@/lib/consultas";
import { formatoFechaHora, formatoRelativo } from "@/lib/formato";
import { ahora, cargarReloj } from "@/lib/reloj";
import { exigirSesion } from "@/lib/sesion";

export default async function LayoutDelPanel({ children }: LayoutProps<"/panel">) {
  await exigirSesion();
  await cargarReloj();
  const [negocio, ultimos, parados, solicitudes, sinLeer] = await Promise.all([
    elNegocio(),
    ultimosAvisos(),
    cuantosSinRespuesta(),
    cuantasSolicitudesPendientes(),
    avisosSinLeer(),
  ]);
  const hoy = ahora();
  const avisos = ultimos.map((a) => ({
    id: a.id,
    texto: a.texto,
    leido: a.leido,
    ts: formatoRelativo(a.ts, hoy),
    presupuestoId: a.presupuestoId,
  }));

  return (
    <div className="flex min-h-svh">
      <Sidebar parados={parados} solicitudes={solicitudes} avisos={avisos} sinLeer={sinLeer} />
      <div className="flex min-w-0 flex-1 flex-col">
        {process.env.DEMO_MODE === "1" && (
          <BarraReloj desfase={negocio.relojOffsetMs} fecha={formatoFechaHora(hoy)} />
        )}
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
      <Pulso />
      <Toaster position="bottom-right" />
    </div>
  );
}
