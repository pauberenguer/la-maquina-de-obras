"use client";
// El formulario de la contraseña. Un solo campo, y el error dicho en claro.
import { useActionState } from "react";
import { LoaderCircleIcon, LockKeyholeIcon } from "lucide-react";
import { entrar, type EstadoEntrar } from "@/app/entrar/acciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FormularioEntrar({ desde }: { desde: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoEntrar, FormData>(entrar, null);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="desde" value={desde} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contrasena">Contraseña</Label>
        <Input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          disabled={pendiente}
          aria-invalid={estado ? true : undefined}
          className="h-10"
        />
      </div>
      {estado && (
        <p role="alert" className="rounded-lg bg-perdido-fondo px-3 py-2 text-sm text-perdido">
          {estado.mensaje}
        </p>
      )}
      <Button type="submit" size="lg" className="h-10" disabled={pendiente}>
        {pendiente ? <LoaderCircleIcon className="animate-spin" /> : <LockKeyholeIcon />}
        {pendiente ? "Entrando…" : "Entrar al Panel"}
      </Button>
    </form>
  );
}
