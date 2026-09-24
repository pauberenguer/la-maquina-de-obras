"use client";
// El formulario de /solicitar. Corto y honesto: nada de precios ni de plazos
// automáticos. Valida al momento con las mismas reglas que el servidor.
//
// En la fase 0 todavía no guarda: lo dice claro al enviarlo. Guardar la
// solicitud y avisar a Manolo llegan en la fase 1.
import { useState } from "react";
import { InfoIcon, SendIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PLAZOS,
  TIPOS_DE_OBRA,
  validarSolicitud,
  type ErroresSolicitud,
} from "@/lib/solicitud-web";

function leer(formulario: HTMLFormElement): Record<string, unknown> {
  const datos = new FormData(formulario);
  return {
    nombre: String(datos.get("nombre") ?? ""),
    telefono: String(datos.get("telefono") ?? ""),
    email: String(datos.get("email") ?? ""),
    direccion: String(datos.get("direccion") ?? ""),
    obra: String(datos.get("obra") ?? ""),
    plazo: String(datos.get("plazo") ?? ""),
    mensaje: String(datos.get("mensaje") ?? ""),
    consentimiento: datos.get("consentimiento") === "on",
  };
}

export function FormularioSolicitud() {
  const [errores, setErrores] = useState<ErroresSolicitud>({});
  const [listo, setListo] = useState(false);

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const r = validarSolicitud(leer(e.currentTarget));
    if (!r.ok) {
      setErrores(r.errores);
      setListo(false);
      return;
    }
    setErrores({});
    setListo(true);
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      {/* Campo trampa: invisible para las personas, irresistible para los bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="empresa">Empresa</label>
        <input id="empresa" name="empresa" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="nombre" etiqueta="Nombre y Apellidos" error={errores.nombre} className="sm:col-span-2">
          <Input id="nombre" name="nombre" autoComplete="name" required aria-invalid={!!errores.nombre} />
        </Campo>
        <Campo id="telefono" etiqueta="Teléfono" error={errores.telefono}>
          <Input id="telefono" name="telefono" type="tel" inputMode="tel" autoComplete="tel" required aria-invalid={!!errores.telefono} />
        </Campo>
        <Campo id="email" etiqueta="Email" opcional error={errores.email}>
          <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!errores.email} />
        </Campo>
        <Campo id="direccion" etiqueta="Dirección de la Obra" error={errores.direccion} className="sm:col-span-2">
          <Input id="direccion" name="direccion" autoComplete="street-address" placeholder="Calle, número, piso y población" required aria-invalid={!!errores.direccion} />
        </Campo>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">¿Qué Obra Es?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIPOS_DE_OBRA.map((t) => (
            <Opcion key={t.clave} nombre="obra" valor={t.clave} etiqueta={t.etiqueta} />
          ))}
        </div>
        {errores.obra && <Error texto={errores.obra} />}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">¿Para Cuándo?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PLAZOS.map((p) => (
            <Opcion key={p.clave} nombre="plazo" valor={p.clave} etiqueta={p.etiqueta} />
          ))}
        </div>
        {errores.plazo && <Error texto={errores.plazo} />}
      </fieldset>

      <Campo id="mensaje" etiqueta="Cuéntanos Qué Quieres Hacer" error={errores.mensaje}>
        <Textarea
          id="mensaje"
          name="mensaje"
          rows={5}
          required
          aria-invalid={!!errores.mensaje}
          placeholder="Por ejemplo: queremos cambiar la bañera por un plato de ducha y poner azulejos nuevos en el baño."
          className="leading-relaxed"
        />
      </Campo>

      <div>
        <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <input name="consentimiento" type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" />
          <span>
            Acepto que Reformas Soler use estos datos solo para contactarme sobre mi obra.
          </span>
        </label>
        {errores.consentimiento && <Error texto={errores.consentimiento} />}
      </div>

      {listo && (
        <p role="status" className="flex items-start gap-2 rounded-lg border bg-secondary px-3 py-2.5 text-sm">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-marca" />
          <span>
            El formulario está bien rellenado, pero todavía no envía nada: guardar la solicitud y
            avisar a Manolo es la fase 1.
          </span>
        </p>
      )}

      <Button type="submit" size="lg" className="h-11 w-full sm:w-auto sm:self-start">
        <SendIcon />
        Enviar Solicitud
      </Button>
    </form>
  );
}

function Campo({
  id,
  etiqueta,
  opcional,
  error,
  className,
  children,
}: {
  id: string;
  etiqueta: string;
  opcional?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {etiqueta}
        {opcional && <span className="font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {children}
      {error && <Error texto={error} />}
    </div>
  );
}

function Opcion({ nombre, valor, etiqueta }: { nombre: string; valor: string; etiqueta: string }) {
  return (
    <label className="cursor-pointer">
      <input type="radio" name={nombre} value={valor} className="peer sr-only" />
      <span className="inline-flex h-9 items-center rounded-lg border bg-card px-3.5 text-sm font-medium transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 hover:bg-secondary peer-checked:hover:bg-primary">
        {etiqueta}
      </span>
    </label>
  );
}

function Error({ texto }: { texto: string }) {
  return <p className="mt-1 text-sm text-perdido">{texto}</p>;
}
