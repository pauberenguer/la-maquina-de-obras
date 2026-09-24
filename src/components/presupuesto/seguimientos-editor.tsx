"use client";
// Las dos acciones del seguimiento que todavía no ha salido: cambiarle el texto
// y cancelarlo. Viven aparte porque la pestaña Seguimientos se pinta en el
// servidor y esto necesita manos.
//
// DUEÑO: carril C.
import { useState, useTransition } from "react";
import { CircleSlashIcon, PencilLineIcon } from "lucide-react";
import { toast } from "sonner";
import {
  cancelarSeguimiento,
  guardarTextoDeSeguimiento,
} from "@/app/panel/presupuestos/[id]/tareas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AccionesDelSeguimiento({ tareaId, texto }: { tareaId: number; texto: string }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(texto);
  const [pendiente, empezar] = useTransition();

  function guardar() {
    empezar(async () => {
      const r = await guardarTextoDeSeguimiento(tareaId, valor);
      if (r.ok) {
        toast.success(r.mensaje);
        setEditando(false);
      } else {
        toast.error(r.mensaje);
      }
    });
  }

  function cancelar() {
    empezar(async () => {
      const r = await cancelarSeguimiento(tareaId);
      if (r.ok) toast.success(r.mensaje);
      else toast.error(r.mensaje);
    });
  }

  if (!editando) {
    return (
      <>
        <p className="mt-2 border-l-2 border-enviado/40 pl-3 text-sm leading-relaxed text-muted-foreground">
          {texto}
        </p>
        <div className="mt-2 flex items-center gap-1">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              setValor(texto);
              setEditando(true);
            }}
            disabled={pendiente}
          >
            <PencilLineIcon data-icon="inline-start" />
            Editar Texto
          </Button>
          <Button size="xs" variant="ghost" onClick={cancelar} disabled={pendiente}>
            <CircleSlashIcon data-icon="inline-start" />
            Cancelar Este Toque
          </Button>
        </div>
      </>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <Textarea
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        rows={6}
        autoFocus
        aria-label="Texto del Seguimiento"
        className="text-sm leading-relaxed"
      />
      <div className="flex items-center gap-1.5">
        <Button size="sm" onClick={guardar} disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setValor(texto);
            setEditando(false);
          }}
          disabled={pendiente}
        >
          Descartar
        </Button>
      </div>
    </div>
  );
}
