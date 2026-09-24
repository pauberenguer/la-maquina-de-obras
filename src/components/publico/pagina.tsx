"use client";
// El presupuesto como lo ve el cliente: primero en el móvil, donde lo va a
// abrir casi todo el mundo; correcto en el escritorio y correcto impreso.
//
// El total se recalcula en vivo al marcar un opcional con la MISMA función que
// usan el editor y el seed (calcularImportes): aquí no se recalcula nada por
// cuenta propia. El servidor lo persiste y manda los importes de vuelta.
//
// DUEÑO: carril B2.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import {
  CheckIcon,
  CircleAlertIcon,
  DownloadIcon,
  MessageCircleIcon,
  PenLineIcon,
} from "lucide-react";
import { Dudas } from "@/components/publico/dudas";
import { Firma } from "@/components/publico/firma";
import type { DatosPublicos, LineaPublica } from "@/components/publico/datos";
import {
  formatoEuros,
  formatoMedicion,
  formatoPorcentaje,
  formatoTitulo,
  formatoUnidad,
} from "@/lib/formato";
import { calcularImportes, importeDescuento, porCapitulos } from "@/lib/importes";
import type { LineaCalculo } from "@/lib/tipos";

export function PaginaPublica({ datos }: { datos: DatosPublicos }) {
  const router = useRouter();
  const [elegidas, setElegidas] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(datos.lineas.map((l) => [l.id, l.elegida])),
  );
  const [guardando, setGuardando] = useState<number | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [abreFirma, setAbreFirma] = useState(false);
  const [abreDudas, setAbreDudas] = useState(false);
  const [dudaEnviada, setDudaEnviada] = useState(false);

  const lineas = useMemo(
    () => datos.lineas.map((l) => ({ ...l, elegida: elegidas[l.id] ?? l.elegida })),
    [datos.lineas, elegidas],
  );

  // margenPct a 0 a propósito: el margen de Reformas Soler no sale del panel.
  // Base, IVA y total no dependen de él, y el `coste` que devuelve no se usa.
  const importes = useMemo(() => {
    const paraCalcular: LineaCalculo[] = lineas.map((l) => ({
      medicion: l.medicion,
      precio: l.precio,
      margenPct: 0,
      opcional: l.opcional,
      elegida: l.elegida,
    }));
    return {
      ...calcularImportes(paraCalcular, datos.ivaPct, datos.descuentoPct),
      descuento: importeDescuento(paraCalcular, datos.descuentoPct),
    };
  }, [lineas, datos.ivaPct, datos.descuentoPct]);

  const delCuerpo = lineas.filter((l) => !l.opcional);
  const opcionales = lineas.filter((l) => l.opcional);
  const capitulos = porCapitulos(delCuerpo);

  async function marcarOpcional(linea: LineaPublica, elegida: boolean) {
    setGuardando(linea.id);
    setFallo(null);
    setElegidas((antes) => ({ ...antes, [linea.id]: elegida }));
    try {
      const res = await fetch("/api/publico/opcional", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: datos.token, lineaId: linea.id, elegida }),
      });
      if (!res.ok) {
        setElegidas((antes) => ({ ...antes, [linea.id]: !elegida }));
        const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
        setFallo(cuerpo.error ?? "No se ha podido guardar el cambio. Vuelve a intentarlo.");
      }
    } catch {
      setElegidas((antes) => ({ ...antes, [linea.id]: !elegida }));
      setFallo("No hay conexión. Comprueba la red y vuelve a intentarlo.");
    } finally {
      setGuardando(null);
    }
  }

  async function descargarPdf() {
    // Se deja constancia en el timeline y se lanza la impresión del navegador.
    try {
      await fetch("/api/publico/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: datos.token }),
      });
    } catch {
      // Que falle el registro no puede impedir que el cliente se lleve su PDF.
    }
    window.print();
  }

  const puedeAceptar = datos.abierto && !datos.firma;

  return (
    <div
      className={cn(
        // La barra inferior del móvil no puede tapar el final del documento.
        "min-h-svh bg-background sm:pb-10 print:bg-white print:pb-0",
        puedeAceptar ? "pb-32" : "pb-10",
      )}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8 print:max-w-none print:p-0">
        {datos.caducado && !datos.firma && <AvisoCaducado />}
        {datos.firma && <AvisoFirmado sello={datos.firma} />}
        {!datos.firma && (datos.respondido || dudaEnviada) && <AvisoRespondido />}

        <article className="imprimir-limpio overflow-hidden rounded-xl border bg-card">
          {/* ------------------------------------------------------ cabecera */}
          <header data-seccion="cabecera" className="px-5 py-6 sm:px-8 sm:py-7">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
              <div className="min-w-0">
                <p className="text-xl leading-tight font-semibold tracking-tight text-marca">
                  Reformas Soler
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {datos.empresa.direccion}
                  <br />
                  {datos.empresa.telefono} · {datos.empresa.email}
                  <br />
                  CIF {datos.empresa.cif}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-[22px] leading-7 font-semibold tracking-tight">Presupuesto</p>
                <dl className="mt-2 space-y-0.5 text-xs">
                  <Par etiqueta="NÚMERO" valor={datos.numero} />
                  <Par etiqueta="FECHA" valor={datos.fechaDocumento} />
                  {datos.validoHasta && <Par etiqueta="VÁLIDO HASTA" valor={datos.validoHasta} />}
                </dl>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t pt-5">
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
                  PARA
                </p>
                <p className="mt-1 font-medium">{datos.clienteNombre}</p>
                <p className="text-sm text-muted-foreground">{datos.direccionObra}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground">TOTAL</p>
                <p className="cifra text-[30px] leading-9 font-semibold">
                  {formatoEuros(importes.total)}
                </p>
                <p className="text-xs text-muted-foreground">IVA Incluido</p>
              </div>
            </div>

            <p className="mt-5 text-sm font-medium">{formatoTitulo(datos.titulo)}</p>
          </header>

          {/* ----------------------------------------------------- capítulos */}
          <section data-seccion="capitulos" className="border-t px-5 py-5 sm:px-8">
            {capitulos.map(([capitulo, filas]) => (
              <div key={capitulo} className="evitar-corte mb-5 last:mb-0">
                <h2 className="text-xs font-semibold tracking-wide uppercase">{capitulo}</h2>
                <ul className="mt-2">
                  {filas.map((linea) => (
                    <FilaLinea key={linea.id} linea={linea} />
                  ))}
                </ul>
                <p className="mt-1.5 flex items-baseline justify-between gap-4 border-t pt-1.5 text-xs">
                  <span className="text-muted-foreground">Subtotal {capitulo.toLowerCase()}</span>
                  <span className="cifra font-medium">
                    {formatoEuros(filas.reduce((s, l) => s + l.total, 0))}
                  </span>
                </p>
              </div>
            ))}
          </section>

          {/* ---------------------------------------------------- opcionales */}
          {opcionales.length > 0 && (
            <section
              data-seccion="opcionales"
              className="evitar-corte border-t bg-secondary/40 px-5 py-5 sm:px-8"
            >
              <h2 className="text-xs font-semibold tracking-wide uppercase">Opcionales</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {datos.abierto
                  ? "Márcalos si los quieres y el total se ajusta al momento."
                  : "Estos son los opcionales de este presupuesto."}
              </p>
              <ul className="mt-3 space-y-2">
                {opcionales.map((linea) => (
                  <FilaOpcional
                    key={linea.id}
                    linea={linea}
                    editable={datos.abierto && !datos.firma}
                    guardando={guardando === linea.id}
                    onCambio={(elegida) => marcarOpcional(linea, elegida)}
                  />
                ))}
              </ul>
              {fallo && (
                <p className="no-imprimir mt-3 rounded-lg bg-perdido-fondo px-3 py-2 text-sm text-perdido">
                  {fallo}
                </p>
              )}
            </section>
          )}

          {/* --------------------------------------------------------- total */}
          <section data-seccion="total" className="evitar-corte border-t px-5 py-5 sm:px-8">
            <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
              {datos.descuentoPct > 0 && (
                <>
                  <Fila
                    etiqueta="Suma de Partidas"
                    valor={formatoEuros(importes.base + importes.descuento)}
                  />
                  <Fila
                    etiqueta={`Descuento (${formatoPorcentaje(datos.descuentoPct, 1)})`}
                    valor={`− ${formatoEuros(importes.descuento)}`}
                    apagado
                  />
                </>
              )}
              <Fila etiqueta="Base Imponible" valor={formatoEuros(importes.base)} />
              <Fila
                etiqueta={`IVA (${formatoPorcentaje(datos.ivaPct, 0)})`}
                valor={formatoEuros(importes.ivaImporte)}
              />
              <div className="flex items-baseline justify-between gap-6 border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="cifra">{formatoEuros(importes.total)}</dd>
              </div>
            </dl>
          </section>

          {/* --------------------------------------------------- condiciones */}
          <section
            data-seccion="condiciones"
            className="evitar-corte border-t px-5 py-5 text-xs leading-relaxed text-muted-foreground sm:px-8"
          >
            <h2 className="text-xs font-semibold tracking-wide text-foreground uppercase">
              Condiciones
            </h2>
            <div className="mt-2 space-y-1">
              {datos.condiciones.split("\n").map((linea, i) => (
                <p key={i}>{linea}</p>
              ))}
            </div>
            {datos.validoHasta && (
              <p className="mt-3 font-medium text-foreground">
                {datos.caducado
                  ? `Este presupuesto era válido hasta el ${datos.validoHasta}.`
                  : `Válido hasta el ${datos.validoHasta}${datos.diasRestantes ? ` · quedan ${datos.diasRestantes}` : ""}.`}
              </p>
            )}
          </section>

          {/* --------------------------------------------------------- firma */}
          <section data-seccion="firma" className="evitar-corte border-t px-5 py-6 sm:px-8">
            {datos.firma ? (
              <Sello sello={datos.firma} total={importes.total} />
            ) : datos.caducado ? (
              <p className="text-sm text-muted-foreground">
                Para retomar esta obra, llama a Manolo al{" "}
                <a
                  href={`tel:${datos.empresa.telefono.replace(/\s/g, "")}`}
                  className="font-medium text-primary"
                >
                  {datos.empresa.telefono}
                </a>{" "}
                y actualizamos los precios.
              </p>
            ) : datos.cerrado ? (
              <p className="text-sm text-muted-foreground">
                Este presupuesto ya está cerrado. Si necesitas otro, llámanos al{" "}
                <span className="cifra font-medium text-foreground">{datos.empresa.telefono}</span>.
              </p>
            ) : (
              <>
                <h2 className="text-base font-semibold tracking-tight">
                  ¿Le Damos al Botón y Empezamos?
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Acepta el presupuesto firmando aquí mismo. Si te queda alguna duda, escríbenos y
                  Manolo te llama.
                </p>
                <div className="no-imprimir mt-4 hidden flex-wrap gap-2 sm:flex">
                  <BotonPrimario onClick={() => setAbreFirma(true)}>
                    <PenLineIcon className="size-4" />
                    Aceptar Presupuesto
                  </BotonPrimario>
                  <BotonSecundario onClick={() => setAbreDudas(true)}>
                    <MessageCircleIcon className="size-4" />
                    Tengo Dudas
                  </BotonSecundario>
                </div>
              </>
            )}

            <div className="no-imprimir mt-4 border-t pt-4">
              <button
                type="button"
                onClick={descargarPdf}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <DownloadIcon className="size-4" />
                Descargar en PDF
              </button>
            </div>
          </section>
        </article>

        <p className="no-imprimir mt-4 text-center text-xs text-muted-foreground">
          {datos.empresa.nombre} · {datos.empresa.telefono} · {datos.empresa.email}
        </p>
      </div>

      {/* Barra inferior fija: en el móvil el botón de aceptar está siempre a mano. */}
      {puedeAceptar && (
        <div className="no-imprimir fixed inset-x-0 bottom-0 z-40 border-t bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
          <p className="mb-2 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
            <span>Total con IVA</span>
            <span className="cifra text-base font-semibold text-foreground">
              {formatoEuros(importes.total)}
            </span>
          </p>
          <div className="flex gap-2">
            <BotonSecundario onClick={() => setAbreDudas(true)} className="flex-1">
              <MessageCircleIcon className="size-4" />
              Tengo Dudas
            </BotonSecundario>
            <BotonPrimario onClick={() => setAbreFirma(true)} className="flex-[1.4]">
              <PenLineIcon className="size-4" />
              Aceptar
            </BotonPrimario>
          </div>
        </div>
      )}

      {abreFirma && (
        <Firma
          token={datos.token}
          total={importes.total}
          onCerrar={() => setAbreFirma(false)}
          onFirmado={() => {
            setAbreFirma(false);
            router.refresh();
          }}
        />
      )}
      {abreDudas && (
        <Dudas
          token={datos.token}
          telefono={datos.empresa.telefono}
          onCerrar={() => setAbreDudas(false)}
          onEnviado={() => {
            setAbreDudas(false);
            setDudaEnviada(true);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- piezas */

function FilaLinea({ linea }: { linea: LineaPublica }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-border/60 py-2 last:border-0">
      <span className="min-w-0 flex-1 basis-full leading-snug sm:basis-auto">
        {formatoTitulo(linea.descripcion)}
      </span>
      <span className="cifra shrink-0 text-xs whitespace-nowrap text-muted-foreground">
        {formatoMedicion(linea.medicion)} {formatoUnidad(linea.unidad)} ×{" "}
        {formatoEuros(linea.precio)}
      </span>
      <span className="cifra w-24 shrink-0 text-right font-medium whitespace-nowrap">
        {formatoEuros(linea.total)}
      </span>
    </li>
  );
}

function FilaOpcional({
  linea,
  editable,
  guardando,
  onCambio,
}: {
  linea: LineaPublica;
  editable: boolean;
  guardando: boolean;
  onCambio: (elegida: boolean) => void;
}) {
  const contenido = (
    <>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          linea.elegida ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
        )}
      >
        {linea.elegida && <CheckIcon className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block leading-snug">{formatoTitulo(linea.descripcion)}</span>
        <span className="cifra block text-xs text-muted-foreground">
          {formatoMedicion(linea.medicion)} {formatoUnidad(linea.unidad)} ×{" "}
          {formatoEuros(linea.precio)} · {linea.elegida ? "incluido en el total" : "no incluido"}
        </span>
      </span>
      <span className="cifra shrink-0 font-medium whitespace-nowrap">
        {linea.elegida ? "+ " : ""}
        {formatoEuros(linea.total)}
      </span>
    </>
  );

  const clases = cn(
    "flex w-full items-start gap-3 rounded-lg border bg-card px-3 py-2.5 text-left text-sm",
    linea.elegida && "border-primary/40",
    guardando && "opacity-60",
  );

  if (!editable) return <li className={clases}>{contenido}</li>;

  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={linea.elegida}
        disabled={guardando}
        onClick={() => onCambio(!linea.elegida)}
        className={cn(clases, "transition-colors hover:border-primary/60")}
      >
        {contenido}
      </button>
    </li>
  );
}

function Sello({ sello, total }: { sello: NonNullable<DatosPublicos["firma"]>; total: number }) {
  return (
    <div className="evitar-corte">
      <div className="flex items-center gap-2 text-ganado">
        <CheckIcon className="size-5" />
        <h2 className="text-base font-semibold tracking-tight">Presupuesto Aceptado y Firmado</h2>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">FIRMA</p>
          {/* La firma es un data URL: no pasa por el optimizador de imágenes. */}
          <img
            src={sello.png}
            alt="Firma del Cliente"
            className="mt-1 h-20 w-auto max-w-[240px] rounded-md border bg-white object-contain"
          />
        </div>
        <dl className="space-y-0.5 text-xs text-muted-foreground">
          <p>
            Firmado el <span className="text-foreground">{sello.fecha}</span> a las{" "}
            <span className="cifra text-foreground">{sello.hora}</span>
          </p>
          {sello.dispositivo && <p>Desde un {sello.dispositivo}</p>}
          {sello.ip && <p className="cifra">IP {sello.ip}</p>}
          <p className="pt-1 font-medium text-foreground">
            Importe Aceptado: <span className="cifra">{formatoEuros(total)}</span>
          </p>
        </dl>
      </div>
    </div>
  );
}

function AvisoCaducado() {
  return (
    <div className="evitar-corte mb-4 flex items-start gap-3 rounded-xl border border-conversacion/30 bg-conversacion-fondo px-4 py-3">
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-conversacion" />
      <div className="text-sm">
        <p className="font-medium text-conversacion">Este Presupuesto Ha Caducado</p>
        <p className="mt-0.5 text-muted-foreground">
          Puedes consultarlo y descargarlo, pero ya no se puede aceptar: los precios de material
          cambian y hay que revisarlos. Llámanos y te lo actualizamos en el día.
        </p>
      </div>
    </div>
  );
}

function AvisoFirmado({ sello }: { sello: NonNullable<DatosPublicos["firma"]> }) {
  return (
    <div className="evitar-corte mb-4 flex items-start gap-3 rounded-xl border border-ganado/30 bg-ganado-fondo px-4 py-3">
      <CheckIcon className="mt-0.5 size-4 shrink-0 text-ganado" />
      <div className="text-sm">
        <p className="font-medium text-ganado">Presupuesto Aceptado</p>
        <p className="mt-0.5 text-muted-foreground">
          Lo firmaste el {sello.fecha} a las {sello.hora}. Manolo se pondrá en contacto contigo para
          cerrar las fechas de la obra.
        </p>
      </div>
    </div>
  );
}

function AvisoRespondido() {
  return (
    <div className="no-imprimir mb-4 flex items-start gap-3 rounded-xl border border-conversacion/30 bg-conversacion-fondo px-4 py-3">
      <MessageCircleIcon className="mt-0.5 size-4 shrink-0 text-conversacion" />
      <div className="text-sm">
        <p className="font-medium text-conversacion">Hemos Recibido Tu Mensaje</p>
        <p className="mt-0.5 text-muted-foreground">
          Manolo te llama en cuanto pueda. Mientras tanto, el presupuesto sigue aquí por si quieres
          repasarlo.
        </p>
      </div>
    </div>
  );
}

function BotonPrimario({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground transition-colors hover:bg-primary/90",
        className,
      )}
    >
      {children}
    </button>
  );
}

function BotonSecundario({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg border bg-card px-4 font-medium transition-colors hover:bg-secondary",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Par({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 sm:justify-end">
      <dt className="font-medium tracking-wide text-muted-foreground">{etiqueta}</dt>
      <dd className="cifra">{valor}</dd>
    </div>
  );
}

function Fila({
  etiqueta,
  valor,
  apagado,
}: {
  etiqueta: string;
  valor: string;
  apagado?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className={cn(apagado && "text-muted-foreground")}>{etiqueta}</dt>
      <dd className={cn("cifra", apagado && "text-muted-foreground")}>{valor}</dd>
    </div>
  );
}
