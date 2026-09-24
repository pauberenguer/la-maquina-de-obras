"use client";
// La firma del cliente: un lienzo donde se firma con el dedo o con el ratón.
// Sin librerías: pointer events y un canvas.
//
// DUEÑO: carril B2.
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { formatoEuros } from "@/lib/formato";

export function Firma({
  token,
  total,
  onFirmado,
  onCerrar,
}: {
  token: string;
  total: number;
  onFirmado: () => void;
  onCerrar: () => void;
}) {
  const lienzo = useRef<HTMLCanvasElement | null>(null);
  const contexto = useRef<CanvasRenderingContext2D | null>(null);
  const dibujando = useRef(false);
  const [hayTrazo, setHayTrazo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Ajusta el lienzo al ancho real y lo deja en blanco. */
  const preparar = useCallback(() => {
    const canvas = lienzo.current;
    if (!canvas) return;
    const ancho = canvas.clientWidth;
    const alto = canvas.clientHeight;
    const escala = window.devicePixelRatio || 1;
    canvas.width = Math.round(ancho * escala);
    canvas.height = Math.round(alto * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#1B1F24";
    contexto.current = ctx;
  }, []);

  useEffect(() => {
    preparar();
    // Si el móvil gira, el lienzo se rehace: se pierde el trazo, así que se
    // avisa poniendo el botón otra vez en gris.
    const alRedimensionar = () => {
      preparar();
      setHayTrazo(false);
    };
    window.addEventListener("resize", alRedimensionar);
    return () => window.removeEventListener("resize", alRedimensionar);
  }, [preparar]);

  useEffect(() => {
    const alPulsarEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !enviando) onCerrar();
    };
    window.addEventListener("keydown", alPulsarEscape);
    return () => window.removeEventListener("keydown", alPulsarEscape);
  }, [enviando, onCerrar]);

  function punto(e: React.PointerEvent<HTMLCanvasElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - caja.left, y: e.clientY - caja.top };
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = contexto.current;
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const { x, y } = punto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Un toque seco también deja marca.
    ctx.lineTo(x + 0.01, y);
    ctx.stroke();
    setHayTrazo(true);
  }

  function seguir(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = contexto.current;
    if (!ctx) return;
    const { x, y } = punto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function soltar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    dibujando.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function borrar() {
    preparar();
    setHayTrazo(false);
    setError(null);
  }

  async function confirmar() {
    const canvas = lienzo.current;
    if (!canvas || !hayTrazo || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/publico/firma", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, firma: canvas.toDataURL("image/png") }),
      });
      if (!res.ok) {
        const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
        setError(cuerpo.error ?? "No se ha podido guardar la firma. Vuelve a intentarlo.");
        setEnviando(false);
        return;
      }
      onFirmado();
    } catch {
      setError("No hay conexión. Comprueba la red y vuelve a intentarlo.");
      setEnviando(false);
    }
  }

  return (
    <div
      className="no-imprimir fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Firmar el Presupuesto"
    >
      <div className="max-h-full w-full overflow-y-auto rounded-t-xl bg-card p-5 shadow-lg sm:max-w-lg sm:rounded-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Firma Aquí y la Obra Es Tuya</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Aceptas el presupuesto por{" "}
              <strong className="cifra font-semibold text-foreground">{formatoEuros(total)}</strong>,
              IVA incluido.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={enviando}
            aria-label="Cerrar"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <canvas
          ref={lienzo}
          onPointerDown={empezar}
          onPointerMove={seguir}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          onPointerLeave={soltar}
          className="mt-4 h-44 w-full touch-none rounded-lg border border-dashed border-input bg-white sm:h-52"
        />
        <div className="mt-1.5 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {hayTrazo ? "Cuando te guste, confírmala." : "Firma con el dedo o con el ratón."}
          </p>
          <button
            type="button"
            onClick={borrar}
            className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Borrar y Repetir
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-perdido-fondo px-3 py-2 text-sm text-perdido">{error}</p>
        )}

        <button
          type="button"
          onClick={confirmar}
          disabled={!hayTrazo || enviando}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {enviando ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Guardando la Firma…
            </>
          ) : (
            <>
              <CheckIcon className="size-4" />
              Confirmar y Aceptar el Presupuesto
            </>
          )}
        </button>
        <p className="mt-2.5 text-center text-xs leading-relaxed text-muted-foreground">
          Al confirmar se guardan la firma, la fecha y la hora, la dirección IP y el dispositivo
          desde el que firmas.
        </p>
      </div>
    </div>
  );
}
