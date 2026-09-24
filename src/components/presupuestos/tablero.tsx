"use client";
// Presupuestos: kanban con el total en € por columna, y vista lista conmutable
// con buscador y filtro por estado.
import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import { KanbanIcon, ListIcon, SearchIcon } from "lucide-react";
import { EstadoBadge, etiquetaDeEstado } from "@/components/estado-badge";
import { Importe } from "@/components/importe";
import { Input } from "@/components/ui/input";
import { ESTADOS, type Estado } from "@/lib/tipos";
import { formatoEurosCorto, formatoFechaNumerica, formatoTitulo } from "@/lib/formato";

export type TarjetaPresupuesto = {
  id: number;
  numero: string;
  titulo: string;
  clienteNombre: string;
  direccionObra: string;
  estado: Estado;
  total: number;
  margenPct: number;
  creadoEn: number;
  enviadoEn: number | null;
  validoHasta: number | null;
  /** Texto ya calculado en el servidor: «hace 11 días», «caduca en 2 días»… */
  pie: string;
  parado: boolean;
};

export function Tablero({ presupuestos }: { presupuestos: TarjetaPresupuesto[] }) {
  const [vista, setVista] = useState<"kanban" | "lista">("kanban");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Estado | "todos">("todos");

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return presupuestos.filter((p) => {
      if (filtro !== "todos" && p.estado !== filtro) return false;
      if (!texto) return true;
      return (
        p.clienteNombre.toLowerCase().includes(texto) ||
        p.titulo.toLowerCase().includes(texto) ||
        p.numero.toLowerCase().includes(texto) ||
        p.direccionObra.toLowerCase().includes(texto)
      );
    });
  }, [presupuestos, busqueda, filtro]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, obra, número o dirección"
            className="h-9 pl-8"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <BotonFiltro activo={filtro === "todos"} onClick={() => setFiltro("todos")}>
            Todos
          </BotonFiltro>
          {ESTADOS.map((estado) => (
            <BotonFiltro key={estado} activo={filtro === estado} onClick={() => setFiltro(estado)}>
              {etiquetaDeEstado(estado)}
            </BotonFiltro>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1 rounded-lg border bg-card p-0.5">
          <BotonVista activo={vista === "kanban"} onClick={() => setVista("kanban")} icono={KanbanIcon}>
            Kanban
          </BotonVista>
          <BotonVista activo={vista === "lista"} onClick={() => setVista("lista")} icono={ListIcon}>
            Lista
          </BotonVista>
        </div>
      </div>

      {vista === "kanban" ? <Kanban presupuestos={filtrados} /> : <Lista presupuestos={filtrados} />}
    </div>
  );
}

function BotonFiltro({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
        activo
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function BotonVista({
  activo,
  onClick,
  icono: Icono,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  icono: typeof ListIcon;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
        activo ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icono className="size-3.5" />
      {children}
    </button>
  );
}

function Kanban({ presupuestos }: { presupuestos: TarjetaPresupuesto[] }) {
  const columnas = ESTADOS.map((estado) => {
    const filas = presupuestos.filter((p) => p.estado === estado);
    return { estado, filas, total: filas.reduce((s, p) => s + p.total, 0) };
  });

  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {columnas.map(({ estado, filas, total }) => (
        <section key={estado} className="flex w-[272px] shrink-0 flex-col rounded-xl border bg-card">
          <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
            <EstadoBadge estado={estado} tamano="pequeno" />
            <div className="flex items-baseline gap-1.5">
              <Importe centimos={total} corto className="text-sm font-semibold" />
              <span className="cifra text-xs text-muted-foreground">({filas.length})</span>
            </div>
          </header>
          <div className="flex flex-col gap-2 p-2">
            {filas.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                Nada en {etiquetaDeEstado(estado).toLowerCase()}
              </p>
            ) : (
              filas.map((p) => (
                <Link
                  key={p.id}
                  href={`/panel/presupuestos/${p.id}`}
                  className="group rounded-lg border bg-card px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-secondary/50"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{p.clienteNombre}</span>
                    <Importe centimos={p.total} corto className="text-sm font-semibold" />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{formatoTitulo(p.titulo)}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="cifra">{p.numero}</span>
                    <span>·</span>
                    <span className="truncate">{p.pie}</span>
                    {p.parado && (
                      <span className="ml-auto shrink-0 rounded-sm bg-naranja-suave px-1 font-medium text-conversacion">
                        parado
                      </span>
                    )}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function Lista({ presupuestos }: { presupuestos: TarjetaPresupuesto[] }) {
  const total = presupuestos.reduce((s, p) => s + p.total, 0);

  if (presupuestos.length === 0) {
    return (
      <div className="rounded-xl border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
        Ningún presupuesto encaja con lo que has buscado. Prueba con otro cliente, otra obra o quita
        el filtro de estado.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">Número</th>
            <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
            <th className="px-4 py-2.5 text-left font-medium">Obra</th>
            <th className="px-4 py-2.5 text-left font-medium">Estado</th>
            <th className="px-4 py-2.5 text-right font-medium">Margen</th>
            <th className="px-4 py-2.5 text-right font-medium">Importe</th>
            <th className="px-4 py-2.5 text-left font-medium">Enviado</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {presupuestos.map((p) => (
            <tr key={p.id} className="h-10 transition-colors hover:bg-secondary/50">
              <td className="px-4">
                <Link href={`/panel/presupuestos/${p.id}`} className="cifra text-muted-foreground hover:underline">
                  {p.numero}
                </Link>
              </td>
              <td className="max-w-40 truncate px-4">
                <Link href={`/panel/presupuestos/${p.id}`} className="font-medium hover:underline">
                  {p.clienteNombre}
                </Link>
              </td>
              <td className="max-w-64 truncate px-4 text-muted-foreground">{formatoTitulo(p.titulo)}</td>
              <td className="px-4">
                <EstadoBadge estado={p.estado} tamano="pequeno" />
              </td>
              <td className="cifra px-4 text-right text-muted-foreground">
                {Math.round(p.margenPct)} %
              </td>
              <td className="px-4 text-right font-medium">
                <Importe centimos={p.total} />
              </td>
              <td className="cifra px-4 text-muted-foreground">
                {p.enviadoEn ? formatoFechaNumerica(p.enviadoEn) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t bg-secondary/40 text-sm">
          <tr className="h-10">
            <td className="px-4 font-medium" colSpan={5}>
              {presupuestos.length} presupuestos
            </td>
            <td className="cifra px-4 text-right font-semibold">{formatoEurosCorto(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
