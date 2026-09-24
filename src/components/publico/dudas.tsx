"use client";
// «Tengo dudas»: el cliente escribe y Manolo se entera al momento.
//
// DUEÑO: carril B2.
import { useEffect, useState } from "react";
import { Loader2Icon, SendIcon, XIcon } from "lucide-react";

export function Dudas({
  token,
  telefono,
  onEnviado,
  onCerrar,
}: {
  token: string;
  telefono: string;
  onEnviado: () => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const alPulsarEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !enviando) onCerrar();
    };
    window.addEventListener("keydown", alPulsarEscape);
    return () => window.removeEventListener("keydown", alPulsarEscape);
  }, [enviando, onCerrar]);

  async function enviar() {
    const limpio = texto.trim();
    if (limpio.length === 0 || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/publico/dudas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, texto: limpio }),
      });
      if (!res.ok) {
        const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
        setError(cuerpo.error ?? "No se ha podido enviar. Vuelve a intentarlo.");
        setEnviando(false);
        return;
      }
      onEnviado();
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
      aria-label="Escribir una Duda"
    >
      <div className="max-h-full w-full overflow-y-auto rounded-t-xl bg-card p-5 shadow-lg sm:max-w-lg sm:rounded-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">¿Qué Te Ha Quedado por Resolver?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Escríbelo y Manolo te llama. También puedes llamarle al{" "}
              <a href={`tel:${telefono.replace(/\s/g, "")}`} className="font-medium text-primary">
                {telefono}
              </a>
              .
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

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={5}
          autoFocus
          maxLength={2000}
          placeholder="Por ejemplo: ¿el plato de ducha se puede hacer más grande? ¿Cuánto duraría la obra?"
          className="mt-4 w-full resize-y rounded-lg border border-input bg-card px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
        />

        {error && (
          <p className="mt-3 rounded-lg bg-perdido-fondo px-3 py-2 text-sm text-perdido">{error}</p>
        )}

        <button
          type="button"
          onClick={enviar}
          disabled={texto.trim().length === 0 || enviando}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {enviando ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Enviando…
            </>
          ) : (
            <>
              <SendIcon className="size-4" />
              Enviar la Duda
            </>
          )}
        </button>
      </div>
    </div>
  );
}
