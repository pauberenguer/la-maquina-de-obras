"use client";
// El banco de precios en pantalla: buscador, filtros, y el precio y el margen
// editables pinchando la celda. Es la tabla que demuestra que el sistema no
// inventa precios.
import { Fragment, useMemo, useState, useTransition } from "react";
import { cn } from "cn";
import { EllipsisVerticalIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CeldaEditable } from "@/components/precios/celda-editable";
import {
  borrarPartida,
  cambiarActiva,
  guardarMargen,
  guardarPrecio,
} from "@/app/panel/precios/acciones";
import { costeLinea, porCapitulos } from "@/lib/importes";
import {
  formatoEuros,
  formatoNumeroEuros,
  formatoPorcentaje,
  formatoUnidad,
  formatoTitulo,
} from "@/lib/formato";

export type PartidaEnPantalla = {
  id: number;
  codigo: string;
  capitulo: string;
  nombre: string;
  unidad: string;
  /** En céntimos. */
  precio: number;
  margenObjetivo: number;
  activa: boolean;
};

type Filtro = "todas" | "activas" | "inactivas";

function sinTildes(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function BancoDePrecios({ partidas }: { partidas: PartidaEnPantalla[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [capitulo, setCapitulo] = useState("todos");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [aBorrar, setABorrar] = useState<PartidaEnPantalla | null>(null);

  const capitulos = useMemo(
    () => [...new Set(partidas.map((p) => p.capitulo))].sort((a, b) => a.localeCompare(b, "es")),
    [partidas],
  );

  const itemsCapitulo = useMemo(() => {
    const items: Record<string, string> = { todos: "Todos los Capítulos" };
    for (const c of capitulos) items[c] = formatoTitulo(c);
    return items;
  }, [capitulos]);

  const visibles = useMemo(() => {
    const aguja = sinTildes(busqueda.trim());
    return partidas.filter((p) => {
      if (capitulo !== "todos" && p.capitulo !== capitulo) return false;
      if (filtro === "activas" && !p.activa) return false;
      if (filtro === "inactivas" && p.activa) return false;
      if (!aguja) return true;
      return sinTildes(`${p.codigo} ${p.nombre} ${p.capitulo}`).includes(aguja);
    });
  }, [partidas, busqueda, capitulo, filtro]);

  const grupos = useMemo(() => porCapitulos(visibles), [visibles]);
  const hayFiltros = busqueda.trim() !== "" || capitulo !== "todos" || filtro !== "todas";
  const activas = partidas.filter((p) => p.activa).length;

  function limpiar() {
    setBusqueda("");
    setCapitulo("todos");
    setFiltro("todas");
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        {/* Filtros, como en el listado de Holded */}
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
          <div className="relative min-w-52 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código, partida o capítulo"
              aria-label="Buscar en el banco de precios"
              className="pl-7.5"
            />
          </div>

          <Select
            value={capitulo}
            onValueChange={(v) => setCapitulo(String(v ?? "todos"))}
            items={itemsCapitulo}
          >
            <SelectTrigger className="w-56" aria-label="Filtrar por capítulo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(itemsCapitulo).map(([valor, etiqueta]) => (
                <SelectItem key={valor} value={valor}>
                  {etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtro}
            onValueChange={(v) => setFiltro((v ?? "todas") as Filtro)}
            items={{ todas: "Activas e Inactivas", activas: "Solo Activas", inactivas: "Solo Inactivas" }}
          >
            <SelectTrigger className="w-44" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Activas e Inactivas</SelectItem>
              <SelectItem value="activas">Solo Activas</SelectItem>
              <SelectItem value="inactivas">Solo Inactivas</SelectItem>
            </SelectContent>
          </Select>

          {hayFiltros && (
            <Button variant="ghost" size="sm" onClick={limpiar}>
              <XIcon />
              Quitar Filtros
            </Button>
          )}
        </div>

        {visibles.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-medium">Ninguna Partida Encaja con lo que Buscas</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              El banco tiene {partidas.length} partidas. Prueba con el código («ALB»), con una
              palabra de la partida («alicatado») o quita los filtros.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={limpiar}>
              Quitar Filtros
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-28 pl-3">Código</TableHead>
                <TableHead>Partida</TableHead>
                <TableHead className="w-16 text-center">Unidad</TableHead>
                <TableHead className="w-32 text-right">Precio</TableHead>
                <TableHead className="w-28 text-right">Margen</TableHead>
                <TableHead className="w-28 text-right">Coste</TableHead>
                <TableHead className="w-10 pr-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupos.map(([nombreCapitulo, delCapitulo]) => (
                <Fragment key={nombreCapitulo}>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="bg-secondary/70 py-1.5 pl-3">
                      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {nombreCapitulo}
                      </span>
                      <span className="cifra ml-2 text-xs text-muted-foreground">
                        {delCapitulo.length}
                      </span>
                    </TableCell>
                  </TableRow>
                  {delCapitulo.map((p) => (
                    <Fila key={p.id} partida={p} alBorrar={() => setABorrar(p)} />
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span>
            <span className="cifra">{visibles.length}</span>
            {visibles.length !== partidas.length && (
              <>
                {" de "}
                <span className="cifra">{partidas.length}</span>
              </>
            )}{" "}
            {partidas.length === 1 ? "partida" : "partidas"} ·{" "}
            <span className="cifra">{capitulos.length}</span> capítulos ·{" "}
            <span className="cifra">{activas}</span> activas
          </span>
          <span>Precios sin IVA, con material y mano de obra salvo que la partida diga otra cosa.</span>
        </div>
      </div>

      <Dialog open={aBorrar !== null} onOpenChange={(abierto) => !abierto && setABorrar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Borrar {aBorrar?.codigo} del Banco</DialogTitle>
            <DialogDescription>
              {formatoTitulo(aBorrar?.nombre)}. Si esta partida está usada en algún presupuesto no se borrará:
              el sistema te dirá que la desactives para no romper el historial.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>No la Borres</DialogClose>
            {aBorrar && <BotonBorrar id={aBorrar.id} alTerminar={() => setABorrar(null)} />}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Fila({ partida: p, alBorrar }: { partida: PartidaEnPantalla; alBorrar: () => void }) {
  const [pendiente, empezar] = useTransition();
  const coste = costeLinea(p.precio, p.margenObjetivo);

  function alternar() {
    empezar(async () => {
      const r = await cambiarActiva(p.id, !p.activa);
      if (r.ok) toast.success(r.mensaje);
      else toast.error(r.mensaje);
    });
  }

  return (
    <TableRow className={cn("h-10", !p.activa && "opacity-55")}>
      <TableCell className="pl-3">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              p.activa ? "bg-positivo" : "bg-muted-foreground/50",
            )}
          />
          <span className="cifra text-[13px] font-medium">{p.codigo}</span>
        </span>
      </TableCell>
      <TableCell className="max-w-0 truncate whitespace-nowrap" title={formatoTitulo(p.nombre)}>
        {formatoTitulo(p.nombre)}
        {!p.activa && (
          <span className="ml-2 rounded-sm bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            Inactiva
          </span>
        )}
      </TableCell>
      <TableCell className="text-center text-muted-foreground">{formatoUnidad(p.unidad)}</TableCell>
      <TableCell className="p-1 pr-2">
        <CeldaEditable
          etiqueta={`Precio de ${p.codigo}`}
          texto={formatoEuros(p.precio)}
          valorInicial={formatoNumeroEuros(p.precio)}
          guardar={(valor) => guardarPrecio(p.id, valor)}
        />
      </TableCell>
      <TableCell className="p-1 pr-2">
        <CeldaEditable
          etiqueta={`Margen objetivo de ${p.codigo}`}
          texto={formatoPorcentaje(p.margenObjetivo, p.margenObjetivo % 1 === 0 ? 0 : 1)}
          valorInicial={String(p.margenObjetivo).replace(".", ",")}
          guardar={(valor) => guardarMargen(p.id, valor)}
        />
      </TableCell>
      <TableCell className="cifra text-right text-muted-foreground">{formatoEuros(coste)}</TableCell>
      <TableCell className="pr-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" disabled={pendiente} />}
            aria-label={`Acciones de ${p.codigo}`}
          >
            <EllipsisVerticalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem onClick={alternar}>
              {p.activa ? "Desactivar en el Banco" : "Volver a Activar"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={alBorrar}>
              <Trash2Icon />
              Borrar del Banco
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function BotonBorrar({ id, alTerminar }: { id: number; alTerminar: () => void }) {
  const [pendiente, empezar] = useTransition();
  return (
    <Button
      variant="destructive"
      disabled={pendiente}
      onClick={() =>
        empezar(async () => {
          const r = await borrarPartida(id);
          if (r.ok) {
            toast.success(r.mensaje);
            alTerminar();
          } else {
            toast.error(r.mensaje);
          }
        })
      }
    >
      <Trash2Icon />
      {pendiente ? "Borrando…" : "Borrar la Partida"}
    </Button>
  );
}
