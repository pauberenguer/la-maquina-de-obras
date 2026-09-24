"use client";
// Qué hacer con una línea que no está en el banco. El sistema no inventa
// precios, así que solo hay tres salidas honradas:
//   a · Manolo le pone el precio a mano, solo para este presupuesto;
//   b · la descarta;
//   c · la da de alta en el banco, y a partir de ahí el precio existe para todos.
import { useMemo, useState } from "react";
import { BanknoteIcon, LibraryBigIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatoEuros, formatoTitulo, formatoUnidad } from "@/lib/formato";
import { UNIDADES, type Unidad } from "@/lib/tipos";
import { aCentimos, aNumero } from "./numeros";
import { Selector } from "./selector";
import type { LineaEditable, PartidaBanco } from "./tipos";

const UNIDAD_OPCIONES = UNIDADES.map((u) => ({ valor: u, etiqueta: formatoUnidad(u) }));

/** Sin tildes, en mayúsculas: «Albañilería» → «ALBANILERIA». */
function sinTildes(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

/** El siguiente código libre del capítulo, con el prefijo que ya usa el banco. */
function codigoSugerido(banco: PartidaBanco[], capitulo: string): string {
  const delCapitulo = banco.filter((p) => p.capitulo === capitulo);
  const prefijo = delCapitulo[0]?.codigo.split("-")[0] ?? sinTildes(capitulo).replace(/[^A-Z]/g, "").slice(0, 3);
  const usados = banco
    .filter((p) => p.codigo.startsWith(`${prefijo}-`))
    .map((p) => Number(p.codigo.split("-")[1]))
    .filter(Number.isFinite);
  const siguiente = usados.length ? Math.max(...usados) + 1 : 1;
  return `${prefijo}-${String(siguiente).padStart(2, "0")}`;
}

export function ResolverAmarilla({
  linea,
  banco,
  capitulos,
  onPrecioAMano,
  onDescartar,
  onAlBanco,
  trabajando,
}: {
  linea: LineaEditable;
  banco: PartidaBanco[];
  capitulos: string[];
  onPrecioAMano: (precio: number, margenPct: number) => void;
  onDescartar: () => void;
  onAlBanco: (datos: {
    codigo: string;
    capitulo: string;
    nombre: string;
    unidad: string;
    precio: number;
    margenObjetivo: number;
  }) => void;
  trabajando: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Button variant="outline" size="xs" onClick={() => setAbierto(true)} disabled={trabajando}>
        <TriangleAlertIcon className="text-amarilla" />
        Ponerle Precio
      </Button>
      {abierto && (
        <DialogoResolver
          linea={linea}
          banco={banco}
          capitulos={capitulos}
          onCerrar={() => setAbierto(false)}
          onPrecioAMano={onPrecioAMano}
          onDescartar={onDescartar}
          onAlBanco={onAlBanco}
          trabajando={trabajando}
        />
      )}
    </>
  );
}

function DialogoResolver({
  linea,
  banco,
  capitulos,
  onCerrar,
  onPrecioAMano,
  onDescartar,
  onAlBanco,
  trabajando,
}: {
  linea: LineaEditable;
  banco: PartidaBanco[];
  capitulos: string[];
  onCerrar: () => void;
  onPrecioAMano: (precio: number, margenPct: number) => void;
  onDescartar: () => void;
  onAlBanco: (datos: {
    codigo: string;
    capitulo: string;
    nombre: string;
    unidad: string;
    precio: number;
    margenObjetivo: number;
  }) => void;
  trabajando: boolean;
}) {
  const [via, setVia] = useState<"mano" | "banco" | "descartar">("mano");
  const [precio, setPrecio] = useState("");
  const [margen, setMargen] = useState("30");

  // Los datos del alta en el banco
  const capitulosDisponibles = useMemo(
    () => (capitulos.length ? capitulos : ["Gestión y varios"]),
    [capitulos],
  );
  const [capitulo, setCapitulo] = useState(
    capitulosDisponibles.includes(linea.capitulo) ? linea.capitulo : capitulosDisponibles[0],
  );
  const [codigo, setCodigo] = useState(() => codigoSugerido(banco, capitulo));
  const [nombre, setNombre] = useState(linea.descripcion);
  const [unidad, setUnidad] = useState<Unidad>(linea.unidad);

  const centimos = aCentimos(precio);
  const margenNum = aNumero(margen);
  const precioValido = Number.isFinite(centimos) && centimos > 0;
  const margenValido = Number.isFinite(margenNum) && margenNum >= 0 && margenNum < 100;
  const totalPrevisto = precioValido ? Math.round(centimos * linea.medicion) : 0;

  function cambiarCapitulo(nuevo: string) {
    setCapitulo(nuevo);
    setCodigo(codigoSugerido(banco, nuevo));
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Esta Línea No Está en el Banco</DialogTitle>
          <DialogDescription>
            La máquina no se inventa precios. Ponle tú el precio, dala de alta en el banco o
            quítala del presupuesto.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amarilla/60 bg-amarilla-fondo px-3 py-2.5">
          <p className="text-sm leading-snug font-medium">{formatoTitulo(linea.descripcion)}</p>
          <p className="cifra mt-0.5 text-xs text-muted-foreground">
            {linea.medicion} {formatoUnidad(linea.unidad)} · {formatoTitulo(linea.capitulo)}
          </p>
          {linea.motivoIa && (
            <p className="mt-1.5 border-l-2 border-amarilla pl-2 text-xs text-muted-foreground">
              {linea.motivoIa}
            </p>
          )}
        </div>

        <div role="radiogroup" aria-label="Qué Hacer con la Línea" className="grid gap-1.5">
          <Opcion
            icono={BanknoteIcon}
            titulo="Ponerle Precio a Mano"
            texto="Solo para este presupuesto. No entra en el banco."
            elegida={via === "mano"}
            onElegir={() => setVia("mano")}
          />
          <Opcion
            icono={LibraryBigIcon}
            titulo="Darla de Alta en el Banco"
            texto="A partir de ahora estará disponible para todos los presupuestos."
            elegida={via === "banco"}
            onElegir={() => setVia("banco")}
          />
          <Opcion
            icono={Trash2Icon}
            titulo="Quitarla del Presupuesto"
            texto="La línea desaparece del documento."
            elegida={via === "descartar"}
            onElegir={() => setVia("descartar")}
          />
        </div>

        {via !== "descartar" && (
          <div className="grid gap-3 border-t pt-3">
            {via === "banco" && (
              <>
                <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                  <Campo etiqueta="Capítulo" id="capitulo">
                    <Selector
                      id="capitulo"
                      valor={capitulo}
                      onCambiar={cambiarCapitulo}
                      opciones={capitulosDisponibles.map((c) => ({ valor: c, etiqueta: c }))}
                      className="w-full"
                    />
                  </Campo>
                  <Campo etiqueta="Código" id="codigo">
                    <Input
                      id="codigo"
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                      className="cifra"
                    />
                  </Campo>
                </div>
                <Campo etiqueta="Nombre de la Partida" id="nombre">
                  <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </Campo>
              </>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              {via === "banco" && (
                <Campo etiqueta="Unidad" id="unidad">
                  <Selector
                    id="unidad"
                    valor={unidad}
                    onCambiar={(v) => setUnidad(v as Unidad)}
                    opciones={UNIDAD_OPCIONES}
                    className="w-full"
                  />
                </Campo>
              )}
              <Campo etiqueta={`Precio por ${formatoUnidad(unidad)}`} id="precio">
                <Input
                  id="precio"
                  autoFocus
                  inputMode="decimal"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  placeholder="0,00"
                  className="cifra text-right"
                />
              </Campo>
              <Campo etiqueta="Margen %" id="margen">
                <Input
                  id="margen"
                  inputMode="decimal"
                  value={margen}
                  onChange={(e) => setMargen(e.target.value)}
                  className="cifra text-right"
                />
              </Campo>
            </div>

            <p className="text-xs text-muted-foreground">
              {precioValido ? (
                <>
                  La línea quedará en{" "}
                  <span className="cifra font-medium text-foreground">
                    {formatoEuros(totalPrevisto)}
                  </span>{" "}
                  ({linea.medicion} {formatoUnidad(unidad)} × {formatoEuros(centimos)}).
                </>
              ) : (
                "Escribe el precio por unidad y verás aquí lo que suma la línea."
              )}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={trabajando}>
            Cancelar
          </Button>
          {via === "descartar" ? (
            <Button
              variant="destructive"
              disabled={trabajando}
              onClick={() => {
                onDescartar();
                onCerrar();
              }}
            >
              <Trash2Icon />
              Quitar la Línea
            </Button>
          ) : (
            <Button
              disabled={
                trabajando ||
                !precioValido ||
                !margenValido ||
                (via === "banco" && (!codigo.trim() || !nombre.trim()))
              }
              onClick={() => {
                if (via === "mano") onPrecioAMano(centimos, margenNum);
                else
                  onAlBanco({
                    codigo: codigo.trim(),
                    capitulo,
                    nombre: nombre.trim(),
                    unidad,
                    precio: centimos,
                    margenObjetivo: margenNum,
                  });
                onCerrar();
              }}
            >
              {via === "mano" ? "Ponerle Este Precio" : "Dar de Alta y Usarla"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Opcion({
  icono: Icono,
  titulo,
  texto,
  elegida,
  onElegir,
}: {
  icono: typeof BanknoteIcon;
  titulo: string;
  texto: string;
  elegida: boolean;
  onElegir: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={elegida}
      onClick={onElegir}
      className={
        "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors " +
        (elegida ? "border-primary bg-primary/5" : "border-border hover:bg-secondary")
      }
    >
      <Icono className={"mt-0.5 size-4 shrink-0 " + (elegida ? "text-primary" : "text-muted-foreground")} />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{texto}</span>
      </span>
    </button>
  );
}

function Campo({
  etiqueta,
  id,
  children,
}: {
  etiqueta: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {etiqueta}
      </Label>
      {children}
    </div>
  );
}
