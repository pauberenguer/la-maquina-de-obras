// Clientes: quién es quién, cuántos presupuestos tiene y cuánto ha contratado.
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Importe } from "@/components/importe";
import { PageHeader } from "@/components/page-header";
import { clientesConResumen } from "@/lib/consultas";
import { formatoEurosCorto, formatoRelativo } from "@/lib/formato";
import { ahora, cargarReloj } from "@/lib/reloj";

export const dynamic = "force-dynamic";

export default async function Clientes() {
  await cargarReloj();
  const clientes = await clientesConResumen();
  const hoy = ahora();
  const contratado = clientes.reduce((s, c) => s + c.contratado, 0);
  const ganados = clientes.reduce((s, c) => s + c.ganados, 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <PageHeader
        titulo="Clientes"
        subtitulo={
          <>
            {clientes.length} clientes · {ganados} obras ganadas por {formatoEurosCorto(contratado)}{" "}
            contratados
          </>
        }
      />

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
              <th className="px-4 py-2.5 text-left font-medium">Contacto</th>
              <th className="px-4 py-2.5 text-right font-medium">Presupuestos</th>
              <th className="px-4 py-2.5 text-right font-medium">Ganados</th>
              <th className="px-4 py-2.5 text-right font-medium">Contratado</th>
              <th className="px-4 py-2.5 text-left font-medium">Último</th>
              <th className="w-8 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {clientes.map((c) => (
              <tr key={c.id} className="h-10 transition-colors hover:bg-secondary/50">
                <td className="px-4">
                  <Link href={`/panel/clientes/${c.id}`} className="font-medium hover:underline">
                    {c.nombre}
                  </Link>
                </td>
                <td className="px-4 text-muted-foreground">
                  {[c.telefono, c.email].filter(Boolean).join(" · ") || "sin contacto"}
                </td>
                <td className="cifra px-4 text-right text-muted-foreground">{c.presupuestos}</td>
                <td className="cifra px-4 text-right">
                  {c.ganados > 0 ? (
                    <span className="font-medium text-positivo">{c.ganados}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="px-4 text-right font-medium">
                  {c.contratado > 0 ? (
                    <Importe centimos={c.contratado} tono="positivo" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 text-muted-foreground">
                  {c.ultimoEn ? formatoRelativo(c.ultimoEn, hoy) : "—"}
                </td>
                <td className="px-4 text-right">
                  <Link href={`/panel/clientes/${c.id}`} aria-label={`Ver a ${c.nombre}`}>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
