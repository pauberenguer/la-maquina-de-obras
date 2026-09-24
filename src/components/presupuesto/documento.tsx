// El presupuesto como documento: la misma pieza que ve Manolo en la ficha y que
// ve el cliente en su página pública. Capítulos con subtotal, base, IVA y total.
import { cn } from "cn";
import { Importe } from "@/components/importe";
import { porCapitulos } from "@/lib/importes";
import {
  formatoEuros,
  formatoFecha,
  formatoMedicion,
  formatoPorcentaje,
  formatoTitulo,
  formatoUnidad,
} from "@/lib/formato";
import type { Linea, Negocio, PresupuestoConCliente } from "@/lib/consultas";

export function Documento({
  negocio,
  presupuesto,
  lineas,
  className,
  conCondiciones = true,
}: {
  negocio: Negocio;
  presupuesto: PresupuestoConCliente;
  lineas: Linea[];
  className?: string;
  conCondiciones?: boolean;
}) {
  const visibles = lineas.filter((l) => !l.opcional);
  const opcionales = lineas.filter((l) => l.opcional);
  const capitulos = porCapitulos(visibles);
  const descuento = presupuesto.descuentoPct > 0;

  return (
    <article className={cn("imprimir-limpio rounded-xl border bg-card px-6 py-6 sm:px-8", className)}>
      {/* Cabecera: la empresa a la izquierda, el documento a la derecha */}
      <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight text-marca">{negocio.nombre}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {negocio.direccion}
            <br />
            {negocio.telefono} · {negocio.email}
            <br />
            CIF {negocio.cif}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[22px] leading-7 font-semibold tracking-tight">Presupuesto</p>
          <dl className="mt-2 space-y-0.5 text-xs">
            <Par etiqueta="NÚMERO" valor={presupuesto.numero} />
            <Par etiqueta="FECHA" valor={formatoFecha(presupuesto.enviadoEn ?? presupuesto.creadoEn)} />
            <Par
              etiqueta="VÁLIDO HASTA"
              valor={presupuesto.validoHasta ? formatoFecha(presupuesto.validoHasta) : "al enviarlo"}
            />
          </dl>
        </div>
      </header>

      {/* Cliente y total */}
      <section className="flex flex-wrap items-end justify-between gap-6 border-b py-6">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">CLIENTE</p>
          <p className="mt-1 font-medium">{presupuesto.clienteNombre}</p>
          <p className="text-sm text-muted-foreground">{presupuesto.direccionObra}</p>
          {(presupuesto.clienteTelefono || presupuesto.clienteEmail) && (
            <p className="text-sm text-muted-foreground">
              {[presupuesto.clienteTelefono, presupuesto.clienteEmail].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">TOTAL</p>
          <Importe centimos={presupuesto.total} className="text-[30px] leading-9 font-semibold" />
        </div>
      </section>

      <p className="pt-6 pb-3 text-sm font-medium">{formatoTitulo(presupuesto.titulo)}</p>

      {/* Las partidas, por capítulos */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] tracking-wide text-muted-foreground">
            <th className="w-1/2 py-2 text-left font-medium">DESCRIPCIÓN</th>
            <th className="py-2 text-right font-medium">MEDICIÓN</th>
            <th className="py-2 text-right font-medium">PRECIO</th>
            <th className="py-2 text-right font-medium">TOTAL</th>
          </tr>
        </thead>
        {capitulos.map(([capitulo, filas]) => {
          const subtotal = filas.reduce((s, l) => s + l.total, 0);
          return (
            <tbody key={capitulo} className="evitar-corte">
              <tr>
                <td colSpan={4} className="pt-4 pb-1 text-xs font-semibold tracking-wide uppercase">
                  {formatoTitulo(capitulo)}
                </td>
              </tr>
              {filas.map((linea) => (
                <FilaLinea key={linea.id} linea={linea} />
              ))}
              <tr className="text-xs">
                <td colSpan={3} className="py-1.5 text-right text-muted-foreground">
                  Subtotal {capitulo.toLowerCase()}
                </td>
                <td className="py-1.5 text-right font-medium">
                  <Importe centimos={subtotal} />
                </td>
              </tr>
            </tbody>
          );
        })}
      </table>

      {opcionales.length > 0 && (
        <section className="evitar-corte mt-6">
          <p className="text-xs font-semibold tracking-wide uppercase">Opcionales</p>
          <p className="mb-1 text-xs text-muted-foreground">
            No están incluidos en el total. El cliente los marca en su página si los quiere.
          </p>
          <table className="w-full text-sm">
            <tbody>
              {opcionales.map((linea) => (
                <FilaLinea key={linea.id} linea={linea} opcional />
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Base, IVA y total */}
      <section className="evitar-corte mt-6 flex flex-wrap justify-between gap-6 border-t pt-4">
        <div className="min-w-0 max-w-sm text-xs text-muted-foreground">
          {conCondiciones && (
            <>
              <p className="font-medium text-foreground">Condiciones</p>
              <div className="mt-1 space-y-1 leading-relaxed">
                {negocio.condiciones.split("\n").map((linea, i) => (
                  <p key={i}>{linea}</p>
                ))}
              </div>
            </>
          )}
        </div>
        <dl className="min-w-56 space-y-1 text-sm">
          {descuento && (
            <>
              <Fila etiqueta="Suma de Partidas" valor={presupuesto.base + descuentoImporte(presupuesto)} />
              <Fila
                etiqueta={`Descuento (${formatoPorcentaje(presupuesto.descuentoPct, 1)})`}
                valor={-descuentoImporte(presupuesto)}
                tono="apagado"
              />
            </>
          )}
          <Fila etiqueta="Base Imponible" valor={presupuesto.base} />
          <Fila etiqueta={`IVA (${formatoPorcentaje(presupuesto.ivaPct, 0)})`} valor={presupuesto.ivaImporte} />
          <div className="flex items-baseline justify-between gap-6 border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>
              <Importe centimos={presupuesto.total} />
            </dd>
          </div>
        </dl>
      </section>
    </article>
  );
}

function descuentoImporte(p: PresupuestoConCliente): number {
  if (p.descuentoPct <= 0) return 0;
  return Math.round((p.base / (1 - p.descuentoPct / 100)) * (p.descuentoPct / 100));
}

function FilaLinea({ linea, opcional = false }: { linea: Linea; opcional?: boolean }) {
  return (
    <tr
      className={cn(
        "border-b border-border/60 last:border-0",
        linea.amarilla && "bg-amarilla-fondo",
        opcional && "text-muted-foreground",
      )}
    >
      <td className="py-2 pr-3 align-top">
        <span className={cn("leading-snug", linea.amarilla && "font-medium")}>{formatoTitulo(linea.descripcion)}</span>
        {linea.amarilla && (
          <span className="mt-0.5 block text-xs text-conversacion">
            Fuera del banco de precios: falta ponerle precio
          </span>
        )}
      </td>
      <td className="cifra py-2 text-right align-top whitespace-nowrap text-muted-foreground">
        {formatoMedicion(linea.medicion)} {formatoUnidad(linea.unidad)}
      </td>
      <td className="cifra py-2 pl-3 text-right align-top whitespace-nowrap text-muted-foreground">
        {linea.amarilla ? "—" : formatoEuros(linea.precio)}
      </td>
      <td className="cifra py-2 pl-3 text-right align-top font-medium whitespace-nowrap">
        {linea.amarilla ? "—" : formatoEuros(linea.total)}
      </td>
    </tr>
  );
}

function Fila({
  etiqueta,
  valor,
  tono,
}: {
  etiqueta: string;
  valor: number;
  tono?: "apagado";
}) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className={cn(tono === "apagado" && "text-muted-foreground")}>{etiqueta}</dt>
      <dd>
        <Importe centimos={valor} tono={tono === "apagado" ? "apagado" : undefined} />
      </dd>
    </div>
  );
}

function Par({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-end gap-4">
      <dt className="font-medium tracking-wide text-muted-foreground">{etiqueta}</dt>
      <dd className="cifra">{valor}</dd>
    </div>
  );
}
