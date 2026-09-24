// La ficha de un cliente: sus datos y todo su historial de presupuestos.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { EstadoBadge } from "@/components/estado-badge";
import { Importe } from "@/components/importe";
import { clientePorId, presupuestosDeCliente } from "@/lib/consultas";
import { formatoEurosCorto, formatoFechaNumerica, formatoTitulo } from "@/lib/formato";
import type { Estado } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function FichaDelCliente({ params }: PageProps<"/panel/clientes/[id]">) {
  const { id } = await params;
  const cliente = await clientePorId(Number(id));
  if (!cliente) notFound();

  const presupuestos = await presupuestosDeCliente(cliente.id);
  const ganados = presupuestos.filter((p) => p.estado === "ganado");
  const contratado = ganados.reduce((s, p) => s + p.total, 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div>
        <Link
          href="/panel/clientes"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3" />
          Clientes
        </Link>
        <h1 className="mt-1 text-[22px] leading-7 font-semibold tracking-tight">{cliente.nombre}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[cliente.telefono, cliente.email].filter(Boolean).join(" · ") || "sin datos de contacto"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Dato etiqueta="Presupuestos" valor={String(presupuestos.length)} />
        <Dato etiqueta="Obras Ganadas" valor={String(ganados.length)} />
        <Dato etiqueta="Contratado" valor={formatoEurosCorto(contratado)} />
      </div>

      {cliente.notas && (
        <div className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Notas</p>
          <p className="mt-1 text-sm">{cliente.notas}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        <header className="border-b px-4 py-3">
          <h2 className="font-semibold">Historial</h2>
        </header>
        <table className="w-full text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Número</th>
              <th className="px-4 py-2.5 text-left font-medium">Obra</th>
              <th className="px-4 py-2.5 text-left font-medium">Estado</th>
              <th className="px-4 py-2.5 text-left font-medium">Enviado</th>
              <th className="px-4 py-2.5 text-right font-medium">Importe</th>
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
                <td className="max-w-72 truncate px-4">
                  <Link href={`/panel/presupuestos/${p.id}`} className="hover:underline">
                    {formatoTitulo(p.titulo)}
                  </Link>
                </td>
                <td className="px-4">
                  <EstadoBadge estado={p.estado as Estado} tamano="pequeno" />
                </td>
                <td className="cifra px-4 text-muted-foreground">
                  {p.enviadoEn ? formatoFechaNumerica(p.enviadoEn) : "—"}
                </td>
                <td className="px-4 text-right font-medium">
                  <Importe centimos={p.total} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{etiqueta}</p>
      <p className="cifra mt-1 text-2xl font-semibold">{valor}</p>
    </div>
  );
}
