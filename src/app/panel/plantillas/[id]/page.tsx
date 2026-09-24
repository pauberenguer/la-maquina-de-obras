// La ficha de una plantilla: sus líneas por capítulo con los precios de hoy del
// banco, para ver exactamente qué entra en la obra antes de arrancarla.
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeftIcon } from "lucide-react";
import { db, plantilla } from "@/db";
import { Importe } from "@/components/importe";
import { NuevoPresupuesto } from "@/components/plantillas/tarjeta";
import { paraCalcular } from "@/components/plantillas/resumen";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { elNegocio } from "@/lib/consultas";
import {
  formatoEuros,
  formatoMedicion,
  formatoPorcentaje,
  formatoTitulo,
  formatoUnidad,
} from "@/lib/formato";
import { calcularImportes, porCapitulos, totalLinea } from "@/lib/importes";
import { lineasDePlantilla } from "@/lib/presupuestos";

export const dynamic = "force-dynamic";

export default async function FichaDePlantilla({ params }: PageProps<"/panel/plantillas/[id]">) {
  const { id } = await params;
  const ficha = await db.select().from(plantilla).where(eq(plantilla.id, Number(id))).get();
  if (!ficha) notFound();

  const [negocio, entradas] = await Promise.all([elNegocio(), lineasDePlantilla(ficha.id)]);
  const importes = calcularImportes(paraCalcular(entradas), negocio.ivaPct);
  const opcionales = entradas.filter((l) => l.opcional);
  const capitulos = porCapitulos(entradas.filter((l) => !l.opcional));
  const fueraDelBanco = entradas.filter((l) => l.amarilla).length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/panel/plantillas"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3" />
            Plantillas
          </Link>
          <h1 className="mt-1 text-[22px] leading-7 font-semibold tracking-tight">{formatoTitulo(ficha.nombre)}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{ficha.descripcion}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NuevoPresupuesto
            plantilla={{ id: ficha.id, nombre: ficha.nombre, lineas: entradas.length }}
          />
        </div>
      </div>

      {fueraDelBanco > 0 && (
        <p className="rounded-lg border border-amarilla/60 bg-amarilla-fondo px-3 py-2 text-[13px] leading-relaxed">
          {fueraDelBanco} {fueraDelBanco === 1 ? "línea de esta plantilla ya no tiene" : "líneas de esta plantilla ya no tienen"}{" "}
          partida activa en el banco: {fueraDelBanco === 1 ? "saldrá" : "saldrán"} en amarillo y sin
          precio hasta que se lo pongas en el editor.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Partida</TableHead>
              <TableHead className="w-16 text-center">Unidad</TableHead>
              <TableHead className="w-24 text-right">Medición</TableHead>
              <TableHead className="w-28 text-right">Precio</TableHead>
              <TableHead className="w-24 text-right">Margen</TableHead>
              <TableHead className="w-32 pr-4 text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {capitulos.map(([capitulo, lineas]) => {
              const subtotal = lineas.reduce(
                (suma, l) => suma + totalLinea(l.precio ?? 0, l.medicion),
                0,
              );
              return (
                <Grupo
                  key={capitulo}
                  capitulo={capitulo}
                  lineas={lineas}
                  subtotal={subtotal}
                />
              );
            })}

            {opcionales.length > 0 && (
              <Grupo
                capitulo="Opcionales · los marca el cliente en su página"
                lineas={opcionales}
                subtotal={opcionales.reduce(
                  (suma, l) => suma + totalLinea(l.precio ?? 0, l.medicion),
                  0,
                )}
                apagado
              />
            )}
          </TableBody>
        </Table>

        <dl className="ml-auto max-w-xs space-y-1.5 border-t px-4 py-3 text-sm">
          <Par etiqueta="Base Imponible" valor={<Importe centimos={importes.base} />} />
          <Par
            etiqueta={`IVA ${formatoPorcentaje(negocio.ivaPct, 0)}`}
            valor={<Importe centimos={importes.ivaImporte} />}
          />
          <div className="flex items-baseline justify-between gap-4 border-t pt-1.5">
            <dt className="font-medium">Total Orientativo</dt>
            <dd>
              <Importe centimos={importes.total} className="text-base font-semibold" />
            </dd>
          </div>
          <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
            Con los precios de hoy del banco y sin los opcionales. Margen{" "}
            {formatoPorcentaje(importes.margenPct, 1)}.
          </p>
        </dl>
      </div>
    </div>
  );
}

type LineaDePlantilla = {
  capitulo: string;
  descripcion: string;
  unidad: string;
  medicion: number;
  precio?: number;
  margenPct?: number;
  amarilla?: boolean;
};

function Grupo({
  capitulo,
  lineas,
  subtotal,
  apagado = false,
}: {
  capitulo: string;
  lineas: LineaDePlantilla[];
  subtotal: number;
  apagado?: boolean;
}) {
  return (
    <>
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={6} className="bg-secondary/70 py-1.5 pl-4">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {formatoTitulo(capitulo)}
          </span>
        </TableCell>
      </TableRow>
      {lineas.map((l, i) => (
        <TableRow key={`${capitulo}-${i}`} className={apagado ? "h-10 opacity-70" : "h-10"}>
          <TableCell className="max-w-0 truncate pl-4" title={formatoTitulo(l.descripcion)}>
            {formatoTitulo(l.descripcion)}
            {l.amarilla && (
              <span className="ml-2 rounded-sm bg-amarilla-fondo px-1.5 py-0.5 text-[11px] font-medium text-conversacion">
                fuera del banco
              </span>
            )}
          </TableCell>
          <TableCell className="text-center text-muted-foreground">
            {formatoUnidad(l.unidad)}
          </TableCell>
          <TableCell className="cifra text-right">{formatoMedicion(l.medicion)}</TableCell>
          <TableCell className="cifra text-right text-muted-foreground">
            {l.amarilla ? "—" : formatoEuros(l.precio ?? 0)}
          </TableCell>
          <TableCell className="cifra text-right text-muted-foreground">
            {l.amarilla ? "—" : formatoPorcentaje(l.margenPct ?? 0, 0)}
          </TableCell>
          <TableCell className="cifra pr-4 text-right font-medium">
            {l.amarilla ? "—" : formatoEuros(totalLinea(l.precio ?? 0, l.medicion))}
          </TableCell>
        </TableRow>
      ))}
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={5} className="pl-4 text-right text-xs text-muted-foreground">
          Subtotal {capitulo.split(" · ")[0].toLowerCase()}
        </TableCell>
        <TableCell className="cifra pr-4 text-right text-xs text-muted-foreground">
          {formatoEuros(subtotal)}
        </TableCell>
      </TableRow>
    </>
  );
}

function Par({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
