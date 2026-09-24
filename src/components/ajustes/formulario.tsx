"use client";
// El formulario de Ajustes. Lo que se guarda aquí manda en todo el producto:
// la cabecera del presupuesto, el IVA, la caducidad y los textos de seguimiento.
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { guardarAjustes, type ResultadoAjustes } from "@/app/panel/ajustes/acciones";

export type ValoresAjustes = {
  nombre: string;
  cif: string;
  direccion: string;
  telefono: string;
  email: string;
  colorMarca: string;
  ivaPct: number;
  caducidadDias: number;
  condiciones: string;
  seguimiento1: string;
  seguimiento2: string;
  seguimiento3: string;
};

export function FormularioAjustes({ valores }: { valores: ValoresAjustes }) {
  // Los valores iniciales se fijan al montar y no se tocan más. Al guardar, el
  // servidor vuelve a pintar la página con los datos nuevos, pero los campos ya
  // tienen lo que se escribió: cambiarles el valor inicial después de montados
  // es lo que Base UI no admite.
  const [iniciales] = useState(valores);
  const [estado, accion, pendiente] = useActionState<ResultadoAjustes | null, FormData>(
    guardarAjustes,
    null,
  );

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) toast.success(estado.mensaje);
    else toast.error(estado.mensaje);
  }, [estado]);

  return (
    <form action={accion} className="flex flex-col gap-5">
      <Bloque
        titulo="Mi Empresa"
        texto="Estos datos salen en la cabecera de cada presupuesto y en la página que ve el cliente."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="nombre" etiqueta="Nombre" defaultValue={iniciales.nombre} required />
          <Campo id="cif" etiqueta="CIF" defaultValue={iniciales.cif} />
          <Campo
            id="direccion"
            etiqueta="Dirección"
            defaultValue={iniciales.direccion}
            className="sm:col-span-2"
          />
          <Campo id="telefono" etiqueta="Teléfono" defaultValue={iniciales.telefono} />
          <Campo id="email" etiqueta="Email" type="email" defaultValue={iniciales.email} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="colorMarca">Color de Marca</Label>
            <div className="flex items-center gap-2">
              <Input
                id="colorMarca"
                name="colorMarca"
                type="color"
                defaultValue={iniciales.colorMarca}
                className="h-9 w-14 p-1"
              />
              <span className="text-xs text-muted-foreground">
                El azul marino de Reformas Soler, el que se ve en la barra y en el documento.
              </span>
            </div>
          </div>
        </div>
      </Bloque>

      <Bloque
        titulo="El Presupuesto"
        texto="El IVA y la caducidad que se aplican por defecto a cada presupuesto nuevo."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="ivaPct"
            etiqueta="IVA (%)"
            type="number"
            step="0.5"
            min="0"
            max="100"
            defaultValue={String(iniciales.ivaPct)}
          />
          <Campo
            id="caducidadDias"
            etiqueta="Caducidad por Defecto (días)"
            type="number"
            step="1"
            min="1"
            max="365"
            defaultValue={String(iniciales.caducidadDias)}
          />
          <CampoLargo
            id="condiciones"
            etiqueta="Condiciones"
            filas={9}
            defaultValue={iniciales.condiciones}
            ayuda="Una condición por línea. Salen al pie del presupuesto y en la página del cliente."
            className="sm:col-span-2"
          />
        </div>
      </Bloque>

      <Bloque
        titulo="Los Seguimientos"
        texto="El texto base de los tres toques. La máquina los personaliza con el cliente, la obra, el importe y los días que quedan de validez."
      >
        <div className="grid gap-4">
          <CampoLargo
            id="seguimiento1"
            etiqueta="Seguimiento 1 · a los 3 Días"
            filas={4}
            defaultValue={iniciales.seguimiento1}
            ayuda="Puedes usar {cliente}, {obra}, {total} y {dias}."
          />
          <CampoLargo
            id="seguimiento2"
            etiqueta="Seguimiento 2 · a los 7 Días"
            filas={4}
            defaultValue={iniciales.seguimiento2}
          />
          <CampoLargo
            id="seguimiento3"
            etiqueta="Seguimiento 3 · a los 14 Días, con la Caducidad"
            filas={4}
            defaultValue={iniciales.seguimiento3}
          />
        </div>
      </Bloque>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar Ajustes"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Los cambios se aplican a los presupuestos nuevos; los ya enviados conservan lo que vio el
          cliente.
        </span>
      </div>
    </form>
  );
}

function Bloque({
  titulo,
  texto,
  children,
}: {
  titulo: string;
  texto: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <header className="border-b px-5 py-3.5">
        <h2 className="font-semibold">{titulo}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{texto}</p>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Campo({
  id,
  etiqueta,
  className,
  ...props
}: { id: string; etiqueta: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} name={id} {...props} />
    </div>
  );
}

function CampoLargo({
  id,
  etiqueta,
  filas,
  ayuda,
  className,
  ...props
}: {
  id: string;
  etiqueta: string;
  filas: number;
  ayuda?: string;
} & React.ComponentProps<typeof Textarea>) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{etiqueta}</Label>
      <Textarea id={id} name={id} rows={filas} {...props} />
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}
