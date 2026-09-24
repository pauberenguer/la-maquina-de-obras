"use client";
// El descuento global, con freno. Ningún descuento se aplica sin que Manolo
// haya visto, en euros, el margen que está regalando.
import { useEffect, useState } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Importe } from "@/components/importe";
import { formatoEuros, formatoPorcentaje } from "@/lib/formato";
import { calcularImportes, margenObjetivo } from "@/lib/importes";
import type { LineaCalculo } from "@/lib/tipos";
import { aNumero, numeroAcampo } from "./numeros";
import type { LineaEditable } from "./tipos";

export function Descuento({
  lineas,
  ivaPct,
  descuentoPct,
  onAplicar,
  trabajando,
}: {
  lineas: LineaEditable[];
  ivaPct: number;
  descuentoPct: number;
  onAplicar: (pct: number, confirmado: boolean) => void;
  trabajando: boolean;
}) {
  const [campo, setCampo] = useState(numeroAcampo(descuentoPct));
  const [preguntando, setPreguntando] = useState(false);

  useEffect(() => {
    setCampo(numeroAcampo(descuentoPct));
  }, [descuentoPct]);

  const pedido = aNumero(campo);
  const valido = Number.isFinite(pedido) && pedido >= 0 && pedido <= 100;
  const pct = valido ? pedido : descuentoPct;

  const calculo = lineas.map<LineaCalculo & { margenObjetivo: number }>((l) => ({
    medicion: l.medicion,
    precio: l.precio,
    margenPct: l.margenPct,
    opcional: l.opcional,
    elegida: l.elegida,
    margenObjetivo: l.margenObjetivo,
  }));

  const limpio = calcularImportes(calculo, ivaPct, 0);
  const conDescuento = calcularImportes(calculo, ivaPct, pct);
  const objetivo = margenObjetivo(calculo);

  /** Todo lo que se descuenta sale del margen: el coste no baja. */
  const margenRegalado = limpio.base - conDescuento.base;
  const porDebajo = conDescuento.margenPct < objetivo - 0.05;
  const cambia = Math.abs(pct - descuentoPct) > 0.001;

  function pedirAplicar() {
    if (!valido) return;
    if (porDebajo) setPreguntando(true);
    else onAplicar(pct, true);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="descuento" className="text-xs text-muted-foreground">
        Descuento Global
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id="descuento"
          inputMode="decimal"
          value={campo}
          onChange={(e) => setCampo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              pedirAplicar();
            }
          }}
          aria-invalid={!valido}
          className="cifra w-20 text-right"
        />
        <span className="text-sm text-muted-foreground">%</span>
        <Button
          size="sm"
          variant={porDebajo && cambia ? "destructive" : "outline"}
          className="ml-auto"
          disabled={!valido || !cambia || trabajando}
          onClick={pedirAplicar}
        >
          {porDebajo && cambia ? "Aplicar de Todos Modos" : "Aplicar"}
        </Button>
      </div>

      {!valido && (
        <p className="text-xs text-destructive">
          El descuento tiene que ser un número entre 0 y 100.
        </p>
      )}

      {valido && pct > 0 && (
        <div
          className={
            "rounded-lg border px-3 py-2.5 text-xs leading-relaxed " +
            (porDebajo
              ? "border-perdido/40 bg-perdido-fondo text-perdido"
              : "border-border bg-secondary/60 text-muted-foreground")
          }
        >
          {porDebajo ? (
            <p className="flex items-start gap-1.5">
              <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Este descuento deja el margen en{" "}
                <strong className="cifra">{formatoPorcentaje(conDescuento.margenPct, 1)}</strong>,
                por debajo del <strong className="cifra">{formatoPorcentaje(objetivo, 1)}</strong>{" "}
                objetivo. Son{" "}
                <strong className="cifra">{formatoEuros(margenRegalado)}</strong> de margen que
                regalas.
              </span>
            </p>
          ) : (
            <p>
              El margen queda en{" "}
              <span className="cifra font-medium">
                {formatoPorcentaje(conDescuento.margenPct, 1)}
              </span>
              , sobre el objetivo de{" "}
              <span className="cifra">{formatoPorcentaje(objetivo, 1)}</span>.
            </p>
          )}
          <p className={"mt-1 " + (porDebajo ? "text-perdido/80" : "")}>
            Total con el Descuento: <Importe centimos={conDescuento.total} className="font-medium" />
          </p>
        </div>
      )}

      <Dialog open={preguntando} onOpenChange={setPreguntando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-perdido">
              <TriangleAlertIcon className="size-4" />
              Este Descuento se Come el Margen
            </DialogTitle>
            <DialogDescription>
              Un {formatoPorcentaje(pct, 1)} de descuento deja el margen global en{" "}
              {formatoPorcentaje(conDescuento.margenPct, 1)}, por debajo del{" "}
              {formatoPorcentaje(objetivo, 1)} que marca el banco de precios.
            </DialogDescription>
          </DialogHeader>

          <dl className="space-y-1.5 rounded-lg border border-perdido/30 bg-perdido-fondo px-3 py-2.5 text-sm">
            <Fila etiqueta="Total sin Descuento" valor={<Importe centimos={limpio.total} />} />
            <Fila
              etiqueta="Total con Descuento"
              valor={<Importe centimos={conDescuento.total} className="font-medium" />}
            />
            <Fila
              etiqueta="Margen que Regalas"
              valor={
                <span className="cifra font-semibold text-perdido">
                  −{formatoEuros(margenRegalado)}
                </span>
              }
            />
          </dl>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPreguntando(false);
                setCampo(numeroAcampo(descuentoPct));
              }}
            >
              Dejarlo como Estaba
            </Button>
            <Button
              variant="destructive"
              disabled={trabajando}
              onClick={() => {
                setPreguntando(false);
                onAplicar(pct, true);
              }}
            >
              Sí, aplicar el {formatoPorcentaje(pct, 1)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
