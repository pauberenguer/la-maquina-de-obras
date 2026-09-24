"use client";
// Una plantilla en la lista: qué lleva, cuánto costaría hoy y las dos cosas que
// se hacen con ella — verla o arrancar un presupuesto.
import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRightIcon, EllipsisVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { formatoTitulo } from "@/lib/formato";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Importe } from "@/components/importe";
import { borrarPlantilla, crearDesdePlantilla, type Resultado } from "@/app/panel/plantillas/acciones";

export type PlantillaEnPantalla = {
  id: number;
  nombre: string;
  descripcion: string;
  lineas: number;
  opcionales: number;
  fueraDelBanco: number;
  capitulos: string[];
  total: number;
};

export function TarjetaDePlantilla({ plantilla: p }: { plantilla: PlantillaEnPantalla }) {
  const [borrando, setBorrando] = useState(false);
  const [pendiente, empezar] = useTransition();

  return (
    <div className="flex flex-col rounded-xl border bg-card">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h2 className="font-medium">{formatoTitulo(p.nombre)}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.descripcion}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" disabled={pendiente} />}
            aria-label={`Acciones de ${p.nombre}`}
          >
            <EllipsisVerticalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem variant="destructive" onClick={() => setBorrando(true)}>
              <Trash2Icon />
              Borrar la Plantilla
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <dl className="mt-4 divide-y border-y text-sm">
        <Fila etiqueta="Líneas" valor={<span className="cifra">{p.lineas}</span>} />
        <Fila
          etiqueta="Capítulos"
          valor={<span className="truncate text-muted-foreground">{p.capitulos.map(formatoTitulo).join(" · ")}</span>}
        />
        {p.opcionales > 0 && (
          <Fila
            etiqueta="Opcionales"
            valor={
              <span className="text-muted-foreground">
                <span className="cifra">{p.opcionales}</span> que marca el cliente
              </span>
            }
          />
        )}
        {p.fueraDelBanco > 0 && (
          <Fila
            etiqueta="Fuera del Banco"
            valor={
              <span className="rounded-sm bg-amarilla-fondo px-1.5 py-0.5 text-xs font-medium text-conversacion">
                {p.fueraDelBanco} sin precio
              </span>
            }
          />
        )}
        <Fila
          etiqueta="Importe Orientativo"
          valor={<Importe centimos={p.total} corto className="font-medium" />}
        />
      </dl>

      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <Link
          href={`/panel/plantillas/${p.id}`}
          className="inline-flex items-center gap-0.5 text-sm text-primary hover:underline"
        >
          Ver las Líneas
          <ChevronRightIcon className="size-3.5" />
        </Link>
        <NuevoPresupuesto plantilla={p} />
      </div>

      <Dialog open={borrando} onOpenChange={setBorrando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Borrar «{formatoTitulo(p.nombre)}»</DialogTitle>
            <DialogDescription>
              Los presupuestos que hiciste con ella no cambian: cada uno guarda sus propias líneas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>No la Borres</DialogClose>
            <Button
              variant="destructive"
              disabled={pendiente}
              onClick={() =>
                empezar(async () => {
                  const r = await borrarPlantilla(p.id);
                  if (r.ok) {
                    toast.success(r.mensaje);
                    setBorrando(false);
                  } else toast.error(r.mensaje);
                })
              }
            >
              <Trash2Icon />
              {pendiente ? "Borrando…" : "Borrar la Plantilla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2">
      <dt className="shrink-0 text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 truncate text-right">{valor}</dd>
    </div>
  );
}

/* --------------------------------- nuevo presupuesto desde la plantilla --- */

export function NuevoPresupuesto({
  plantilla: p,
  variante = "default",
}: {
  plantilla: Pick<PlantillaEnPantalla, "id" | "nombre" | "lineas">;
  variante?: "default" | "outline";
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState<Resultado | null, FormData>(
    crearDesdePlantilla,
    null,
  );

  useEffect(() => {
    if (estado && !estado.ok) toast.error(estado.mensaje);
  }, [estado]);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <Button variant={variante} size="sm" onClick={() => setAbierto(true)}>
        <PlusIcon />
        Nuevo Presupuesto
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Presupuesto desde «{formatoTitulo(p.nombre)}»</DialogTitle>
          <DialogDescription>
            Se crea un borrador con las {p.lineas} líneas de la plantilla y los precios de hoy del
            banco. Después ajustas las mediciones en el editor.
          </DialogDescription>
        </DialogHeader>

        <form action={accion} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="plantillaId" value={p.id} />
          <Campo id="clienteNombre" etiqueta="Cliente" placeholder="María Gómez" required />
          <Campo id="telefono" etiqueta="Teléfono" placeholder="612 448 903" />
          <Campo
            id="direccionObra"
            etiqueta="Dirección de la Obra"
            placeholder="Carrer de Mallorca 42, 08013 Barcelona"
            required
            className="sm:col-span-2"
          />
          <Campo id="email" etiqueta="Email" type="email" placeholder="maria.gomez@example.com" />
          <Campo id="titulo" etiqueta="Título" placeholder={formatoTitulo(p.nombre)} />

          <DialogFooter className="sm:col-span-2">
            <DialogClose render={<Button variant="outline" type="button" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? "Creando el Borrador…" : "Crear el Borrador"}
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
