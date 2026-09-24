// Presupuestos: el kanban con el total en € por columna y la vista lista.
import { PageHeader } from "@/components/page-header";
import { Tablero, type TarjetaPresupuesto } from "@/components/presupuestos/tablero";
import { sinRespuesta, todosLosPresupuestos } from "@/lib/consultas";
import { formatoDiasRestantes, formatoEurosCorto, formatoRelativo } from "@/lib/formato";
import { ahora, cargarReloj } from "@/lib/reloj";
import { ESTADOS_VIVOS } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function Presupuestos() {
  await cargarReloj();
  const [sinContestar, todos] = await Promise.all([sinRespuesta(), todosLosPresupuestos()]);
  const hoy = ahora();
  const parados = new Set(sinContestar.map((p) => p.id));

  const tarjetas: TarjetaPresupuesto[] = todos.map((p) => {
    const vivo = (ESTADOS_VIVOS as readonly string[]).includes(p.estado);
    const pie = p.enviadoEn
      ? vivo && p.validoHasta
        ? `caduca en ${formatoDiasRestantes(p.validoHasta, hoy)}`
        : `enviado ${formatoRelativo(p.enviadoEn, hoy)}`
      : `visita ${formatoRelativo(p.visitaEn, hoy)}`;
    return {
      id: p.id,
      numero: p.numero,
      titulo: p.titulo,
      clienteNombre: p.clienteNombre,
      direccionObra: p.direccionObra,
      estado: p.estado as TarjetaPresupuesto["estado"],
      total: p.total,
      margenPct: p.margenPct,
      creadoEn: p.creadoEn.getTime(),
      enviadoEn: p.enviadoEn?.getTime() ?? null,
      validoHasta: p.validoHasta?.getTime() ?? null,
      pie,
      parado: parados.has(p.id),
    };
  });

  const vivos = tarjetas.filter((t) => (ESTADOS_VIVOS as readonly string[]).includes(t.estado));
  const enVivos = vivos.reduce((s, t) => s + t.total, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Presupuestos"
        subtitulo={
          <>
            {todos.length} en total · {vivos.length} vivos por {formatoEurosCorto(enVivos)} ·{" "}
            {parados.size} sin respuesta desde hace más de 7 días
          </>
        }
      />
      <Tablero presupuestos={tarjetas} />
    </div>
  );
}
