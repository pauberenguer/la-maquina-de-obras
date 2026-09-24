"use client";
// El editor del presupuesto. La tabla se recalcula en vivo en el navegador con
// la MISMA calcularImportes() que usan el servidor, la página del cliente y el
// seed: por eso lo que se ve mientras se escribe es exactamente lo que se
// guarda.
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckIcon,
  CirclePlusIcon,
  LoaderCircleIcon,
  SendIcon,
  SquareIcon,
  SquareCheckIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { cn } from "cn";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EstadoBadge } from "@/components/estado-badge";
import { Importe } from "@/components/importe";
import {
  formatoEuros,
  formatoMedicion,
  formatoPorcentaje,
  formatoUnidad,
  formatoTitulo,
} from "@/lib/formato";
import { calcularImportes, margenObjetivo, porCapitulos } from "@/lib/importes";
import { UNIDADES, type LineaCalculo, type Unidad } from "@/lib/tipos";
import {
  alternarOpcional,
  anadirAlBanco,
  anadirDelBanco,
  anadirLineaAMano,
  aplicarDescuento,
  borrarLinea,
  guardarCabecera,
  guardarCaducidad,
  guardarLinea,
  ponerPrecioAMano,
} from "@/app/panel/presupuestos/[id]/editar/acciones";
import { enviarAlCliente } from "@/app/panel/presupuestos/[id]/acciones";
import { BuscadorDelBanco } from "./buscador-banco";
import { CeldaEditable, TextoEditable } from "./celda";
import { Descuento } from "./descuento";
import { aCentimos, aNumero, centimosAcampo, numeroAcampo } from "./numeros";
import { ResolverAmarilla } from "./resolver-amarilla";
import { Selector } from "./selector";
import type { LineaEditable, PartidaBanco, Resultado } from "./tipos";

const UNIDAD_OPCIONES = UNIDADES.map((u) => ({ valor: u, etiqueta: formatoUnidad(u) }));

export function Editor({
  presupuestoId,
  numero,
  clienteNombre,
  tituloInicial,
  direccionInicial,
  ivaPct,
  caducidadInicial,
  descuentoInicial,
  lineasIniciales,
  banco,
  capitulos,
}: {
  presupuestoId: number;
  numero: string;
  clienteNombre: string;
  tituloInicial: string;
  direccionInicial: string;
  ivaPct: number;
  caducidadInicial: number;
  descuentoInicial: number;
  lineasIniciales: LineaEditable[];
  banco: PartidaBanco[];
  capitulos: string[];
}) {
  const router = useRouter();
  const [lineas, setLineas] = useState(lineasIniciales);
  const [descuentoPct, setDescuentoPct] = useState(descuentoInicial);
  const [caducidadDias, setCaducidadDias] = useState(caducidadInicial);
  const [titulo, setTitulo] = useState(tituloInicial);
  const [direccion, setDireccion] = useState(direccionInicial);
  const [trabajando, setTrabajando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | null>(null);
  const [enviando, empezarEnvio] = useTransition();
  const avisoGuardado = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* --------------------------------------------------------- el cálculo */

  const paraCalculo = useMemo(
    () =>
      lineas.map<LineaCalculo & { margenObjetivo: number }>((l) => ({
        medicion: l.medicion,
        precio: l.precio,
        margenPct: l.margenPct,
        opcional: l.opcional,
        elegida: l.elegida,
        margenObjetivo: l.margenObjetivo,
      })),
    [lineas],
  );
  const importes = useMemo(
    () => calcularImportes(paraCalculo, ivaPct, descuentoPct),
    [paraCalculo, ivaPct, descuentoPct],
  );
  const objetivo = useMemo(() => margenObjetivo(paraCalculo), [paraCalculo]);
  const sinDescuento = useMemo(() => calcularImportes(paraCalculo, ivaPct, 0), [paraCalculo, ivaPct]);

  const amarillas = lineas.filter((l) => l.amarilla);
  const ordenadas = useMemo(() => [...lineas].sort((a, b) => a.orden - b.orden), [lineas]);
  const fijas = ordenadas.filter((l) => !l.opcional);
  const opcionales = ordenadas.filter((l) => l.opcional);
  const capitulosVisibles = porCapitulos(fijas);
  const bajoObjetivo = importes.margenPct < objetivo - 0.05;

  /* --------------------------------------------------------- las acciones */

  function marcarGuardado() {
    setGuardadoEn(Date.now());
    if (avisoGuardado.current) clearTimeout(avisoGuardado.current);
    avisoGuardado.current = setTimeout(() => setGuardadoEn(null), 2500);
  }

  /**
   * Lanza una acción del servidor. Lo que se ve ya se ha cambiado en pantalla;
   * si el servidor dice que no, se deshace y se explica por qué.
   */
  async function correr(accion: () => Promise<Resultado>, deshacer?: () => void) {
    setTrabajando(true);
    try {
      const r = await accion();
      if (!r.ok) {
        deshacer?.();
        toast.error(r.mensaje);
        return false;
      }
      if (r.linea) {
        const actualizada = r.linea;
        setLineas((antes) => antes.map((l) => (l.id === actualizada.id ? actualizada : l)));
      }
      setDescuentoPct(r.importes.descuentoPct);
      marcarGuardado();
      return true;
    } catch (e) {
      deshacer?.();
      toast.error((e as Error).message || "No se ha podido guardar el cambio.");
      return false;
    } finally {
      setTrabajando(false);
    }
  }

  /** Cambia una línea en pantalla al momento y la guarda detrás. */
  function cambiarLinea(id: number, parche: Partial<LineaEditable>, guardar: () => Promise<Resultado>) {
    const anterior = lineas.find((l) => l.id === id);
    if (!anterior) return;
    setLineas((antes) =>
      antes.map((l) => {
        if (l.id !== id) return l;
        const nueva = { ...l, ...parche };
        return { ...nueva, total: Math.round(nueva.precio * nueva.medicion) };
      }),
    );
    void correr(guardar, () =>
      setLineas((antes) => antes.map((l) => (l.id === id ? anterior : l))),
    );
  }

  function editarMedicion(l: LineaEditable, texto: string) {
    const valor = aNumero(texto);
    if (!Number.isFinite(valor) || valor < 0) {
      toast.error("La medición tiene que ser un número de cero para arriba.");
      setLineas((antes) => [...antes]);
      return;
    }
    const medicion = Math.round(valor * 100) / 100;
    cambiarLinea(l.id, { medicion }, () => guardarLinea(presupuestoId, l.id, { medicion }));
  }

  function editarMargen(l: LineaEditable, texto: string) {
    const valor = aNumero(texto);
    if (!Number.isFinite(valor) || valor < 0 || valor >= 100) {
      toast.error("El margen tiene que estar entre 0 y 99 %.");
      setLineas((antes) => [...antes]);
      return;
    }
    const margenPct = Math.round(valor * 10) / 10;
    cambiarLinea(l.id, { margenPct }, () => guardarLinea(presupuestoId, l.id, { margenPct }));
  }

  function editarPrecio(l: LineaEditable, texto: string) {
    if (l.partidaId !== null) {
      toast.error("Esta línea sale del banco: su precio se cambia en Precios, no aquí.");
      setLineas((antes) => [...antes]);
      return;
    }
    const centimos = aCentimos(texto);
    if (!Number.isFinite(centimos) || centimos < 0) {
      toast.error("El precio tiene que ser un importe válido.");
      setLineas((antes) => [...antes]);
      return;
    }
    cambiarLinea(
      l.id,
      { precio: centimos, precioManual: true, amarilla: centimos === 0 },
      () => guardarLinea(presupuestoId, l.id, { precio: centimos }),
    );
  }

  function editarDescripcion(l: LineaEditable, texto: string) {
    const descripcion = texto.trim();
    if (!descripcion) {
      toast.error("La descripción no puede quedar vacía.");
      setLineas((antes) => [...antes]);
      return;
    }
    cambiarLinea(l.id, { descripcion }, () => guardarLinea(presupuestoId, l.id, { descripcion }));
  }

  function editarUnidad(l: LineaEditable, unidad: string) {
    cambiarLinea(l.id, { unidad: unidad as Unidad }, () =>
      guardarLinea(presupuestoId, l.id, { unidad }),
    );
  }

  function alternarOpcionalDe(l: LineaEditable) {
    cambiarLinea(l.id, { opcional: !l.opcional, elegida: l.opcional }, () =>
      alternarOpcional(presupuestoId, l.id, !l.opcional),
    );
  }

  function quitarLinea(l: LineaEditable) {
    const antes = lineas;
    setLineas((actuales) => actuales.filter((x) => x.id !== l.id));
    void correr(
      () => borrarLinea(presupuestoId, l.id),
      () => setLineas(antes),
    );
  }

  async function traerDelBanco(partidaId: number) {
    setTrabajando(true);
    try {
      const r = await anadirDelBanco(presupuestoId, partidaId, 1);
      if (!r.ok) return toast.error(r.mensaje);
      if (r.linea) {
        const nueva = r.linea;
        setLineas((antes) => [...antes, nueva]);
        toast.success(`Añadida: ${nueva.descripcion}`);
      }
      marcarGuardado();
    } finally {
      setTrabajando(false);
    }
  }

  async function nuevaLineaAMano() {
    setTrabajando(true);
    try {
      const r = await anadirLineaAMano(
        presupuestoId,
        "Describe aquí lo que hay que hacer",
        "Sin clasificar",
        "ud",
        1,
      );
      if (!r.ok) return toast.error(r.mensaje);
      if (r.linea) {
        const nueva = r.linea;
        setLineas((antes) => [...antes, nueva]);
        toast.info("Línea añadida en amarillo: sin precio hasta que se lo pongas.");
      }
      marcarGuardado();
    } finally {
      setTrabajando(false);
    }
  }

  function resolverConPrecio(l: LineaEditable, precio: number, margenPct: number) {
    cambiarLinea(l.id, { precio, margenPct, precioManual: true, amarilla: false }, () =>
      ponerPrecioAMano(presupuestoId, l.id, precio, margenPct),
    );
  }

  function resolverAlBanco(
    l: LineaEditable,
    datos: {
      codigo: string;
      capitulo: string;
      nombre: string;
      unidad: string;
      precio: number;
      margenObjetivo: number;
    },
  ) {
    const anterior = lineas.find((x) => x.id === l.id);
    void correr(
      async () => {
        const r = await anadirAlBanco(presupuestoId, l.id, datos);
        if (r.ok) {
          toast.success(`${datos.codigo} dada de alta en el banco de precios.`);
          router.refresh();
        }
        return r;
      },
      () => anterior && setLineas((antes) => antes.map((x) => (x.id === l.id ? anterior : x))),
    );
  }

  function cambiarDescuento(pct: number, confirmado: boolean) {
    const antes = descuentoPct;
    setDescuentoPct(pct);
    void correr(
      () => aplicarDescuento(presupuestoId, pct, confirmado),
      () => setDescuentoPct(antes),
    );
  }

  function cambiarCaducidad(texto: string) {
    const valor = aNumero(texto);
    if (!Number.isInteger(valor) || valor < 1 || valor > 365) {
      toast.error("La caducidad tiene que ser un número de días entre 1 y 365.");
      setCaducidadDias((d) => d);
      return;
    }
    const antes = caducidadDias;
    setCaducidadDias(valor);
    void correr(
      () => guardarCaducidad(presupuestoId, valor),
      () => setCaducidadDias(antes),
    );
  }

  function guardarTitulo(nuevoTitulo: string, nuevaDireccion: string) {
    const antesT = titulo;
    const antesD = direccion;
    setTitulo(nuevoTitulo);
    setDireccion(nuevaDireccion);
    void correr(
      () => guardarCabecera(presupuestoId, nuevoTitulo, nuevaDireccion),
      () => {
        setTitulo(antesT);
        setDireccion(antesD);
      },
    );
  }

  function enviar() {
    empezarEnvio(async () => {
      const r = await enviarAlCliente(presupuestoId);
      if (!r.ok) {
        toast.error(r.mensaje);
        return;
      }
      toast.success(r.mensaje);
      router.push(`/panel/presupuestos/${presupuestoId}`);
    });
  }

  const puedeEnviar = lineas.length > 0 && amarillas.length === 0;

  /* ------------------------------------------------------------ pantalla */

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/panel/presupuestos/${presupuestoId}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3" />
            Volver a la Ficha
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-[22px] leading-7 font-semibold tracking-tight">
            {clienteNombre}
            <EstadoBadge estado="borrador" />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="cifra">{numero}</span> · editando el presupuesto antes de enviarlo
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 items-center gap-1.5 text-xs text-muted-foreground">
            {trabajando ? (
              <>
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                Guardando…
              </>
            ) : guardadoEn ? (
              <>
                <CheckIcon className="size-3.5 text-positivo" />
                Guardado
              </>
            ) : null}
          </span>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/panel/presupuestos/${presupuestoId}`} />}
          >
            Ver la Ficha
          </Button>
          <Button onClick={enviar} disabled={!puedeEnviar || enviando || trabajando}>
            {enviando ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />}
            Enviar al Cliente
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ------------------------------------------------ el documento */}
        <div className="rounded-xl border bg-card px-5 py-5 sm:px-6">
          <div className="border-b pb-4">
            <label className="text-[11px] font-medium tracking-wide text-muted-foreground">
              OBRA
            </label>
            <TextoEditable
              valor={formatoTitulo(titulo)}
              onGuardar={(v) => guardarTitulo(v, direccion)}
              className="-ml-1.5 text-base font-medium"
            />
            <TextoEditable
              valor={direccion}
              onGuardar={(v) => guardarTitulo(titulo, v)}
              className="-ml-1.5 text-sm text-muted-foreground"
            />
          </div>

          {lineas.length === 0 ? (
            <p className="px-1 py-12 text-center text-sm text-muted-foreground">
              Este presupuesto todavía no tiene ni una línea. Añade partidas del banco o escribe
              una a mano.
            </p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-[11px] tracking-wide text-muted-foreground">
                  <th className="w-[38%] py-2 text-left font-medium">DESCRIPCIÓN</th>
                  <th className="py-2 text-right font-medium">MEDICIÓN</th>
                  <th className="py-2 text-right font-medium">PRECIO</th>
                  <th className="py-2 text-right font-medium">MARGEN</th>
                  <th className="py-2 text-right font-medium">TOTAL</th>
                  <th className="w-20 py-2" />
                </tr>
              </thead>

              {capitulosVisibles.map(([capitulo, filas]) => (
                <tbody key={capitulo}>
                  <tr>
                    <td colSpan={6} className="pt-4 pb-1 text-xs font-semibold tracking-wide uppercase">
                      {formatoTitulo(capitulo)}
                    </td>
                  </tr>
                  {filas.map((l) => (
                    <Fila
                      key={l.id}
                      linea={l}
                      banco={banco}
                      capitulos={capitulos}
                      trabajando={trabajando}
                      onMedicion={(t) => editarMedicion(l, t)}
                      onPrecio={(t) => editarPrecio(l, t)}
                      onMargen={(t) => editarMargen(l, t)}
                      onDescripcion={(t) => editarDescripcion(l, t)}
                      onUnidad={(u) => editarUnidad(l, u)}
                      onOpcional={() => alternarOpcionalDe(l)}
                      onQuitar={() => quitarLinea(l)}
                      onPrecioAMano={(p, m) => resolverConPrecio(l, p, m)}
                      onAlBanco={(d) => resolverAlBanco(l, d)}
                    />
                  ))}
                  <tr className="text-xs">
                    <td colSpan={4} className="py-1.5 text-right text-muted-foreground">
                      Subtotal {capitulo.toLowerCase()}
                    </td>
                    <td className="py-1.5 pr-1.5 text-right font-medium">
                      <Importe centimos={filas.reduce((s, l) => s + l.total, 0)} />
                    </td>
                    <td />
                  </tr>
                </tbody>
              ))}

              {opcionales.length > 0 && (
                <tbody>
                  <tr>
                    <td colSpan={6} className="pt-5 pb-1">
                      <p className="text-xs font-semibold tracking-wide uppercase">Opcionales</p>
                      <p className="text-xs font-normal normal-case text-muted-foreground">
                        No suman en el total. El cliente los marca en su página y el total se
                        recalcula solo.
                      </p>
                    </td>
                  </tr>
                  {opcionales.map((l) => (
                    <Fila
                      key={l.id}
                      linea={l}
                      banco={banco}
                      capitulos={capitulos}
                      trabajando={trabajando}
                      onMedicion={(t) => editarMedicion(l, t)}
                      onPrecio={(t) => editarPrecio(l, t)}
                      onMargen={(t) => editarMargen(l, t)}
                      onDescripcion={(t) => editarDescripcion(l, t)}
                      onUnidad={(u) => editarUnidad(l, u)}
                      onOpcional={() => alternarOpcionalDe(l)}
                      onQuitar={() => quitarLinea(l)}
                      onPrecioAMano={(p, m) => resolverConPrecio(l, p, m)}
                      onAlBanco={(d) => resolverAlBanco(l, d)}
                    />
                  ))}
                </tbody>
              )}
            </table>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
            <BuscadorDelBanco banco={banco} onElegir={traerDelBanco} deshabilitado={trabajando} />
            <Button variant="ghost" size="sm" onClick={nuevaLineaAMano} disabled={trabajando}>
              <CirclePlusIcon />
              Escribir una Línea a Mano
            </Button>
            <p className="ml-auto text-xs text-muted-foreground">
              {lineas.length} {lineas.length === 1 ? "línea" : "líneas"}
              {opcionales.length > 0 && ` · ${opcionales.length} opcionales`}
            </p>
          </div>
        </div>

        {/* --------------------------------------------------- el panel */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
            <dl className="space-y-1.5 text-sm">
              {descuentoPct > 0 && (
                <>
                  <Par etiqueta="Suma de Partidas" valor={<Importe centimos={sinDescuento.base} />} />
                  <Par
                    etiqueta={`Descuento (${formatoPorcentaje(descuentoPct, 1)})`}
                    valor={
                      <span className="cifra text-perdido">
                        −{formatoEuros(sinDescuento.base - importes.base)}
                      </span>
                    }
                  />
                </>
              )}
              <Par etiqueta="Base Imponible" valor={<Importe centimos={importes.base} />} />
              <Par
                etiqueta={`IVA (${formatoPorcentaje(ivaPct, 0)})`}
                valor={<Importe centimos={importes.ivaImporte} />}
              />
              <div className="flex items-baseline justify-between gap-4 border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>
                  <Importe centimos={importes.total} />
                </dd>
              </div>
            </dl>

            <div className="rounded-lg border bg-secondary/50 px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-muted-foreground">Margen Global</span>
                <span
                  className={cn(
                    "cifra text-lg leading-6 font-semibold",
                    bajoObjetivo ? "text-perdido" : "text-positivo",
                  )}
                >
                  {formatoPorcentaje(importes.margenPct, 1)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                (base − coste) ÷ base · objetivo del banco{" "}
                <span className="cifra">{formatoPorcentaje(objetivo, 1)}</span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Coste Estimado <Importe centimos={importes.coste} className="text-[11px]" />
              </p>
            </div>

            <Descuento
              lineas={lineas}
              ivaPct={ivaPct}
              descuentoPct={descuentoPct}
              onAplicar={cambiarDescuento}
              trabajando={trabajando}
            />

            <div className="space-y-1.5 border-t pt-3">
              <label
                htmlFor="caducidad"
                className="text-xs text-muted-foreground"
              >
                Caducidad del Presupuesto
              </label>
              <div className="flex items-center gap-2">
                <CeldaEditable
                  valor={numeroAcampo(caducidadDias)}
                  onGuardar={cambiarCaducidad}
                  ancho="w-16"
                  sufijo="días desde el envío"
                  deshabilitada={trabajando}
                />
              </div>
            </div>

            {amarillas.length > 0 && (
              <div className="rounded-lg border border-amarilla/60 bg-amarilla-fondo px-3 py-2.5">
                <p className="flex items-start gap-1.5 text-xs leading-relaxed">
                  <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-amarilla" />
                  <span>
                    {amarillas.length === 1
                      ? "Queda 1 línea fuera del banco, sin precio."
                      : `Quedan ${amarillas.length} líneas fuera del banco, sin precio.`}{" "}
                    No se puede enviar hasta que les pongas precio, las descartes o las añadas al
                    banco.
                  </span>
                </p>
              </div>
            )}

            <Button
              className="w-full"
              onClick={enviar}
              disabled={!puedeEnviar || enviando || trabajando}
            >
              {enviando ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />}
              Enviar al Cliente
            </Button>
            <p className="-mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Al enviarlo se genera el enlace del cliente, se fija la caducidad y se programan los
              tres seguimientos con su texto.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- la fila */

function Fila({
  linea,
  banco,
  capitulos,
  trabajando,
  onMedicion,
  onPrecio,
  onMargen,
  onDescripcion,
  onUnidad,
  onOpcional,
  onQuitar,
  onPrecioAMano,
  onAlBanco,
}: {
  linea: LineaEditable;
  banco: PartidaBanco[];
  capitulos: string[];
  trabajando: boolean;
  onMedicion: (texto: string) => void;
  onPrecio: (texto: string) => void;
  onMargen: (texto: string) => void;
  onDescripcion: (texto: string) => void;
  onUnidad: (unidad: string) => void;
  onOpcional: () => void;
  onQuitar: () => void;
  onPrecioAMano: (precio: number, margenPct: number) => void;
  onAlBanco: (datos: {
    codigo: string;
    capitulo: string;
    nombre: string;
    unidad: string;
    precio: number;
    margenObjetivo: number;
  }) => void;
}) {
  const delBanco = linea.partidaId !== null;

  return (
    <tr
      className={cn(
        "h-10 border-b border-border/60 last:border-0",
        linea.amarilla && "bg-amarilla-fondo",
        linea.opcional && !linea.amarilla && "text-muted-foreground",
      )}
    >
      <td className="py-1 pr-2 align-middle">
        <TextoEditable
          valor={formatoTitulo(linea.descripcion)}
          onGuardar={onDescripcion}
          deshabilitada={trabajando}
          className={cn("text-sm", linea.amarilla && "font-medium")}
        />
        {linea.amarilla ? (
          <p className="mt-0.5 pl-1.5 text-xs text-conversacion">
            Fuera del banco de precios
            {linea.motivoIa ? `: ${linea.motivoIa}` : ": falta ponerle precio"}
          </p>
        ) : (
          linea.confianza !== null &&
          linea.confianza < 1 && (
            <p className="mt-0.5 pl-1.5 text-[11px] text-muted-foreground">
              Casada con el banco · confianza {formatoPorcentaje(linea.confianza * 100, 0)}
            </p>
          )
        )}
      </td>

      <td className="py-1 text-right align-middle whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <CeldaEditable
            valor={numeroAcampo(linea.medicion)}
            onGuardar={onMedicion}
            ancho="w-16"
            deshabilitada={trabajando}
            titulo="Medición"
          />
          <Selector
            valor={linea.unidad}
            onCambiar={onUnidad}
            opciones={UNIDAD_OPCIONES}
            deshabilitado={trabajando || delBanco}
            aria-label="Unidad"
            className="h-7 w-16 border-transparent px-1 text-xs hover:border-input"
          />
        </span>
      </td>

      <td className="py-1 text-right align-middle whitespace-nowrap">
        {linea.amarilla ? (
          <span className="cifra px-1.5 text-muted-foreground">—</span>
        ) : delBanco ? (
          <span
            className="cifra px-1.5 text-muted-foreground"
            title="Precio del banco. Se cambia en la página Precios."
          >
            {formatoEuros(linea.precio)}
          </span>
        ) : (
          <CeldaEditable
            valor={centimosAcampo(linea.precio)}
            onGuardar={onPrecio}
            ancho="w-24"
            sufijo="€"
            deshabilitada={trabajando}
            titulo="Precio por unidad, escrito a mano"
          />
        )}
      </td>

      <td className="py-1 text-right align-middle whitespace-nowrap">
        {linea.amarilla ? (
          <span className="cifra px-1.5 text-muted-foreground">—</span>
        ) : (
          <CeldaEditable
            valor={numeroAcampo(linea.margenPct)}
            onGuardar={onMargen}
            ancho="w-12"
            sufijo="%"
            deshabilitada={trabajando}
            titulo={`Margen de la línea · objetivo del banco ${formatoPorcentaje(linea.margenObjetivo, 0)}`}
          />
        )}
      </td>

      <td className="cifra py-1 pr-1.5 text-right align-middle font-medium whitespace-nowrap">
        {linea.amarilla ? "—" : formatoEuros(linea.total)}
      </td>

      <td className="py-1 align-middle">
        <div className="flex items-center justify-end gap-0.5">
          {linea.amarilla ? (
            <ResolverAmarilla
              linea={linea}
              banco={banco}
              capitulos={capitulos}
              onPrecioAMano={onPrecioAMano}
              onDescartar={onQuitar}
              onAlBanco={onAlBanco}
              trabajando={trabajando}
            />
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onOpcional}
                disabled={trabajando}
                title={linea.opcional ? "Volverla Obligatoria" : "Marcarla como Opcional"}
                aria-label={linea.opcional ? "Volverla Obligatoria" : "Marcarla como Opcional"}
              >
                {linea.opcional ? (
                  <SquareCheckIcon className="text-conversacion" />
                ) : (
                  <SquareIcon className="text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onQuitar}
                disabled={trabajando}
                title="Quitar la Línea"
                aria-label="Quitar la Línea"
              >
                <Trash2Icon className="text-muted-foreground" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
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
