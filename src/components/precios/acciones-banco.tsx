"use client";
// Las dos acciones de la cabecera de Precios: dar de alta una partida a mano y
// volver a cargar el banco desde un CSV.
import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { FileUpIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  crearPartida,
  importarCsv,
  reimportarBancoOriginal,
  type Resultado,
  type ResultadoImportacion,
} from "@/app/panel/precios/acciones";
import { formatoUnidad } from "@/lib/formato";
import { UNIDADES } from "@/lib/tipos";

const ETIQUETA_UNIDAD: Record<string, string> = Object.fromEntries(
  UNIDADES.map((u) => [u, `${formatoUnidad(u)}${u === "pa" ? " · partida alzada" : ""}`]),
);

export function AccionesDelBanco({ capitulos }: { capitulos: string[] }) {
  return (
    <>
      <ImportarBanco />
      <NuevaPartida capitulos={capitulos} />
    </>
  );
}

/* ------------------------------------------------------------ nueva partida */

function NuevaPartida({ capitulos }: { capitulos: string[] }) {
  const [abierto, setAbierto] = useState(false);
  const listaId = useId();
  const [estado, accion, pendiente] = useActionState<Resultado | null, FormData>(
    crearPartida,
    null,
  );

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      toast.success(estado.mensaje);
      setAbierto(false);
    } else {
      toast.error(estado.mensaje);
    }
  }, [estado]);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <Button onClick={() => setAbierto(true)}>
        <PlusIcon />
        Nueva Partida
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva Partida</DialogTitle>
          <DialogDescription>
            A partir de ahora la máquina podrá usar este precio al casar una visita. Mientras no
            esté aquí, esa línea saldrá en amarillo y sin precio.
          </DialogDescription>
        </DialogHeader>

        <form action={accion} className="grid gap-3 sm:grid-cols-2">
          <Campo id="codigo" etiqueta="Código" placeholder="ALB-11" required autoCapitalize="characters" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="capitulo">Capítulo</Label>
            <Input
              id="capitulo"
              name="capitulo"
              list={listaId}
              placeholder="Albañilería"
              required
            />
            <datalist id={listaId}>
              {capitulos.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="nombre">Partida</Label>
            <Input
              id="nombre"
              name="nombre"
              placeholder="Formación de peldaño de obra con acabado de gres"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unidad">Unidad</Label>
            <Select name="unidad" defaultValue="ud" items={ETIQUETA_UNIDAD}>
              <SelectTrigger id="unidad" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES.map((u) => (
                  <SelectItem key={u} value={u}>
                    {ETIQUETA_UNIDAD[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Campo id="precio" etiqueta="Precio sin IVA (€)" placeholder="84,50" required inputMode="decimal" />
          <Campo
            id="margenObjetivo"
            etiqueta="Margen Objetivo (%)"
            placeholder="30"
            required
            inputMode="decimal"
            className="sm:col-span-2 sm:max-w-[calc(50%-0.375rem)]"
          />

          <DialogFooter className="sm:col-span-2">
            <DialogClose render={<Button variant="outline" type="button" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? "Guardando…" : "Añadir al Banco"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  id,
  etiqueta,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { id: string; etiqueta: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} name={id} {...props} />
    </div>
  );
}

/* --------------------------------------------------------------- importar */

function resumen(r: ResultadoImportacion): string {
  const altas = r.altas ?? 0;
  const actualizadas = r.actualizadas ?? 0;
  const partes: string[] = [];
  if (altas) partes.push(`${altas} ${altas === 1 ? "partida nueva" : "partidas nuevas"}`);
  if (actualizadas)
    partes.push(`${actualizadas} ${actualizadas === 1 ? "actualizada" : "actualizadas"}`);
  return partes.length ? partes.join(" · ") : "El CSV no traía ninguna partida";
}

function ImportarBanco() {
  const [abierto, setAbierto] = useState(false);
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [recargando, recargar] = useTransition();
  const [estado, accion, pendiente] = useActionState<ResultadoImportacion | null, FormData>(
    importarCsv,
    null,
  );

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      toast.success(`CSV importado · ${resumen(estado)}`);
      setUltimo(resumen(estado));
    } else {
      toast.error(estado.mensaje);
    }
  }, [estado]);

  function volverAlOriginal() {
    recargar(async () => {
      const r = await reimportarBancoOriginal();
      if (r.ok) {
        toast.success(`Banco reimportado · ${resumen(r)}`);
        setUltimo(resumen(r));
      } else {
        toast.error(r.mensaje);
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <Button variant="outline" onClick={() => setAbierto(true)}>
        <FileUpIcon />
        Importar CSV
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar el Banco de Precios</DialogTitle>
          <DialogDescription>
            Columnas: <span className="cifra">codigo, capitulo, partida, unidad, precio,
            margen_objetivo</span>. Las partidas que ya existan se actualizan por su código y las
            nuevas se dan de alta; no se borra ninguna.
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-lg border border-amarilla/60 bg-amarilla-fondo px-3 py-2 text-[13px] leading-relaxed">
          Ojo: importar <strong>pisa los precios y los márgenes que hayas editado a mano</strong> en
          las partidas que vengan en el fichero. Los presupuestos ya hechos no cambian: cada línea
          guarda el precio con el que se hizo.
        </p>

        <form action={accion} className="flex flex-col gap-1.5">
          <Label htmlFor="csv">Fichero CSV</Label>
          <Input id="csv" name="csv" type="file" accept=".csv,text/csv" required className="h-9 py-1.5" />
          <DialogFooter className="mt-3">
            <Button
              type="button"
              variant="outline"
              disabled={recargando || pendiente}
              onClick={volverAlOriginal}
            >
              {recargando ? "Cargando…" : "Recargar el Banco de Reformas Soler"}
            </Button>
            <Button type="submit" disabled={pendiente || recargando}>
              {pendiente ? "Importando…" : "Importar el Fichero"}
            </Button>
          </DialogFooter>
        </form>

        {ultimo && <p className="text-xs text-muted-foreground">Última importación: {ultimo}.</p>}
      </DialogContent>
    </Dialog>
  );
}
