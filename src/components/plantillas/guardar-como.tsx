"use client";
// El formulario de «Guardar como Plantilla»: ponerle nombre a lo que ya está
// hecho para no volver a montarlo desde cero.
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { guardarComoPlantilla, type Resultado } from "@/app/panel/plantillas/acciones";

export function GuardarComoPlantilla({
  presupuestoId,
  nombreSugerido,
  descripcionSugerida,
}: {
  presupuestoId: number;
  nombreSugerido: string;
  descripcionSugerida: string;
}) {
  const [estado, accion, pendiente] = useActionState<Resultado | null, FormData>(
    guardarComoPlantilla,
    null,
  );

  useEffect(() => {
    if (estado && !estado.ok) toast.error(estado.mensaje);
  }, [estado]);

  return (
    <form action={accion} className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <input type="hidden" name="presupuestoId" value={presupuestoId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nombre">Nombre de la Plantilla</Label>
        <Input
          id="nombre"
          name="nombre"
          defaultValue={nombreSugerido}
          placeholder="Baño completo"
          required
        />
        <p className="text-xs text-muted-foreground">
          Como lo dirías en obra: «Baño completo», «Cocina con isla», «Pintura integral».
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="descripcion">Para Qué Sirve</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          rows={3}
          defaultValue={descripcionSugerida}
          placeholder="Baño de 4 a 5 m² con ducha, gama media. Demolición, instalaciones, alicatado y sanitarios."
          required
        />
        <p className="text-xs text-muted-foreground">
          Los metros, la gama y qué entra. Es lo que leerás dentro de seis meses para saber si te
          sirve.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar como Plantilla"}
        </Button>
      </div>
    </form>
  );
}
