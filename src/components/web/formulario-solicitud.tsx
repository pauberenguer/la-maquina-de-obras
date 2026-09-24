"use client";
// El formulario de /solicitar. Corto y honesto: nada de precios ni de plazos
// automáticos. Valida al momento con las mismas reglas que el servidor, pero
// quien decide es el servidor: sus errores son los que se enseñan.
import { useState, useTransition } from "react";
import { CircleCheckIcon, LoaderCircleIcon, SendIcon } from "lucide-react";
import { enviarSolicitud } from "@/app/solicitar/acciones";
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
    empresa: String(datos.get("empresa") ?? ""),
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

export function FormularioSolicitud({ telefono }: { telefono: string }) {
  const [errores, setErrores] = useState<ErroresSolicitud>({});
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [enviada, setEnviada] = useState<{ nombre: string } | null>(null);
  const [enviando, empezar] = useTransition();

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const crudo = leer(e.currentTarget);
    const local = validarSolicitud(crudo);
    if (!local.ok) {
      setErrores(local.errores);
      setMensaje(null);
      return;
    }
    setErrores({});
    setMensaje(null);
    empezar(async () => {
      try {
        const r = await enviarSolicitud(crudo);
        if (r.ok) setEnviada({ nombre: r.nombre });
        else {
          setErrores(r.errores ?? {});
          setMensaje(r.mensaje ?? null);
        }
      } catch {
        setMensaje(`No hemos podido enviar la solicitud. Inténtalo de nuevo o llámanos al ${telefono}.`);
      }
    });
  }

  if (enviada) {
    return (
      <div role="status" className="flex flex-col items-start gap-4 py-6">
        <span className="flex size-11 items-center justify-center rounded-full bg-ganado-fondo text-ganado">
          <CircleCheckIcon className="size-6" />
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {enviada.nombre ? `Gracias, ${enviada.nombre}` : "Gracias"}
          </h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Hemos recibido tu solicitud. Manolo te llamará para concertar la visita: sin ver la obra
            no damos precios, porque cada casa es distinta. Después de la visita, tendrás el
            presupuesto al día siguiente.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          ¿Te corre prisa? Llámanos al{" "}
          <a href={`tel:${telefono.replace(/\s/g, "")}`} className="cifra font-medium text-foreground hover:underline">
            {telefono}
          </a>
          .
        </p>
      </div>
    );
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

      {mensaje && (
        <p role="alert" className="rounded-lg bg-perdido-fondo px-3 py-2.5 text-sm text-perdido">
          {mensaje}
        </p>
      )}

      <Button type="submit" size="lg" disabled={enviando} className="h-11 w-full sm:w-auto sm:self-start">
        {enviando ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />}
        {enviando ? "Enviando…" : "Enviar Solicitud"}
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
