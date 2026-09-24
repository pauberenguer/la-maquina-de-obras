"use client";
// Los dos botones de una solicitud. «Convertir» pasa por la IA, así que la
// interfaz dice lo que está haciendo mientras tanto: nunca un spinner mudo.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, LoaderIcon, PhoneIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  convertirSolicitud,
  descartarSolicitud,
  recuperarSolicitud,
} from "@/app/panel/solicitudes/acciones";

export function AccionesDeSolicitud({
  solicitudId,
  estado,
  presupuestoId,
  telefono = null,
  deLaWeb = false,
}: {
  solicitudId: number;
  estado: string;
  presupuestoId: number | null;
  /** Solo en las solicitudes de la web: lo primero es llamar al cliente. */
  telefono?: string | null;
  deLaWeb?: boolean;
}) {
  const router = useRouter();
  const [convirtiendo, convertir] = useTransition();
  const [moviendo, mover] = useTransition();

  if (estado === "convertida") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={!presupuestoId}
        onClick={() => presupuestoId && router.push(`/panel/presupuestos/${presupuestoId}`)}
      >
        Ver el Presupuesto
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    );
  }

  if (estado === "descartada") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={moviendo}
        onClick={() =>
          mover(async () => {
            await recuperarSolicitud(solicitudId);
            toast.success("La solicitud vuelve a la bandeja.");
          })
        }
      >
        <RotateCcwIcon data-icon="inline-start" />
        {moviendo ? "Recuperando…" : "Recuperar"}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {telefono && (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={`tel:${telefono.replace(/\s/g, "")}`} />}
        >
          <PhoneIcon data-icon="inline-start" />
          Llamar
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={convirtiendo || moviendo}
        onClick={() =>
          mover(async () => {
            await descartarSolicitud(solicitudId);
            toast.success("Solicitud descartada.");
          })
        }
      >
        <XIcon data-icon="inline-start" />
        {moviendo ? "Descartando…" : "Descartar"}
      </Button>

      <Button
        size="sm"
        disabled={convirtiendo || moviendo}
        onClick={() =>
          convertir(async () => {
            const fallo = await convertirSolicitud(solicitudId);
            if (fallo && !fallo.ok) toast.error(fallo.mensaje);
          })
        }
      >
        {convirtiendo ? (
          <>
            <LoaderIcon data-icon="inline-start" className="animate-spin" />
            {deLaWeb ? "Leyendo lo que Pide el Cliente…" : "Casando Partidas contra el Banco…"}
          </>
        ) : (
          <>
            Convertir en Presupuesto
            <ArrowRightIcon data-icon="inline-end" />
          </>
        )}
      </Button>
    </div>
  );
}
