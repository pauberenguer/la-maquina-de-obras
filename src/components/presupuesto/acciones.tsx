"use client";
// Las acciones de la ficha: abrir el editor si es Borrador, enviar al cliente,
// reenviar, marcar Ganado a mano y marcar Perdido con motivo.
//
// DUEÑO: carril B (fases 3 y 4).
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleCheckIcon,
  CircleSlashIcon,
  LoaderCircleIcon,
  PencilIcon,
  SendIcon,
  LayoutTemplateIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  enviarAlCliente,
  marcarGanado,
  marcarPerdido,
  reenviarAlCliente,
  type ResultadoAccion,
} from "@/app/panel/presupuestos/[id]/acciones";
import type { PresupuestoConCliente } from "@/lib/consultas";
import type { Estado } from "@/lib/tipos";

const MOTIVOS = [
  "Precio: Le Ha Parecido Caro",
  "Ha Cogido Otro Presupuesto",
  "Aplaza la Obra",
  "No Contesta",
];

export function AccionesDelPresupuesto({
  presupuesto,
  amarillas = 0,
}: {
  presupuesto: PresupuestoConCliente;
  /** Líneas fuera del banco: mientras queden, no se puede enviar. */
  amarillas?: number;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [preguntandoPerdido, setPreguntandoPerdido] = useState(false);
  const [motivo, setMotivo] = useState("");

  const estado = presupuesto.estado as Estado;
  const esBorrador = estado === "borrador";
  const estaVivo = estado === "enviado" || estado === "visto" || estado === "en_conversacion";
  const estaCerrado = estado === "ganado" || estado === "perdido" || estado === "expirado";

  function lanzar(accion: () => Promise<ResultadoAccion>) {
    empezar(async () => {
      const r = await accion();
      if (!r.ok) {
        toast.error(r.mensaje);
        return;
      }
      toast.success(r.mensaje);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 border-t pt-4">
      {esBorrador && (
        <>
          <Button
            variant="outline"
            className="w-full"
            disabled={pendiente}
            nativeButton={false}
            render={<Link href={`/panel/presupuestos/${presupuesto.id}/editar`} />}
          >
            <PencilIcon />
            Abrir el Editor
          </Button>

          <Button
            className="w-full"
            disabled={pendiente || amarillas > 0}
            onClick={() => lanzar(() => enviarAlCliente(presupuesto.id))}
          >
            {pendiente ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />}
            Enviar al Cliente
          </Button>

          {amarillas > 0 && (
            <p className="text-[11px] leading-relaxed text-conversacion">
              {amarillas === 1
                ? "Queda 1 línea sin precio."
                : `Quedan ${amarillas} líneas sin precio.`}{" "}
              Resuélvelas en el editor antes de enviarlo.
            </p>
          )}
        </>
      )}

      {estaVivo && (
        <>
          <Button
            variant="outline"
            className="w-full"
            disabled={pendiente}
            onClick={() => lanzar(() => reenviarAlCliente(presupuesto.id))}
          >
            {pendiente ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />}
            Reenviar al Cliente
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              disabled={pendiente}
              onClick={() => lanzar(() => marcarGanado(presupuesto.id))}
            >
              <CircleCheckIcon className="text-ganado" />
              Ganado
            </Button>
            <Button
              variant="outline"
              disabled={pendiente}
              onClick={() => {
                setMotivo("");
                setPreguntandoPerdido(true);
              }}
            >
              <CircleSlashIcon className="text-perdido" />
              Perdido
            </Button>
          </div>
        </>
      )}

      {estaCerrado && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {estado === "ganado"
            ? "Obra ganada. Los seguimientos pendientes se cancelaron al cerrarla."
            : estado === "perdido"
              ? "Presupuesto perdido. Queda en el historial del cliente y cuenta en la tasa de firma."
              : "Presupuesto caducado. Si el cliente lo vuelve a abrir, te avisa: es señal de compra."}
        </p>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        nativeButton={false}
        render={<Link href={`/panel/plantillas/nueva?desde=${presupuesto.id}`} />}
      >
        <LayoutTemplateIcon />
        Guardar como Plantilla
      </Button>

      <Dialog open={preguntandoPerdido} onOpenChange={setPreguntandoPerdido}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Por Qué se Ha Perdido?</DialogTitle>
            <DialogDescription>
              El motivo se guarda en la ficha y en el timeline. Es lo que luego te dice por qué
              pierdes obras.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS.map((m) => (
                <Button key={m} variant="outline" size="xs" onClick={() => setMotivo(m)}>
                  {m}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motivo" className="text-xs text-muted-foreground">
                Motivo
              </Label>
              <Textarea
                id="motivo"
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Se lo ha quedado otro industrial más barato."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreguntandoPerdido(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pendiente || !motivo.trim()}
              onClick={() => {
                setPreguntandoPerdido(false);
                lanzar(() => marcarPerdido(presupuesto.id, motivo));
              }}
            >
              Marcar como Perdido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
