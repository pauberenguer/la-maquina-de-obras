"use client";
// El panel en vivo: pregunta cada 3 segundos si algo ha cambiado y, si ha
// cambiado, refresca la página. Sin SSE ni websockets.
//
// Tres cosas que tiene que respetar, porque va montado en TODAS las páginas del
// panel: no parpadear, no robar el foco de un input y no perder el scroll.
// router.refresh() de Next conserva las tres; lo demás es no hacer ruido.
//
// DUEÑO: carril C.
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function Pulso({ intervaloMs = 3000 }: { intervaloMs?: number }) {
  const router = useRouter();
  // La última versión vista. Se guarda en una ref para que cambiarla no
  // provoque un render: este componente no pinta nada.
  const version = useRef<number | null>(null);

  useEffect(() => {
    let vivo = true;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const aborto = new AbortController();

    async function latir() {
      // Con la pestaña en segundo plano no se pregunta: ni gasta ni se
      // descontrola. Al volver, el listener de abajo dispara un latido.
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch("/api/pulso", {
            cache: "no-store",
            signal: aborto.signal,
          });
          if (res.ok) {
            const { version: actual } = (await res.json()) as { version: number };
            if (version.current === null) {
              // Primer latido: solo establece la referencia, no refresca.
              version.current = actual;
            } else if (actual !== version.current) {
              version.current = actual;
              router.refresh();
            }
          }
        } catch {
          // Servidor recargando o petición cancelada: se reintenta al siguiente
          // latido sin decir nada. El panel nunca enseña un error de polling.
        }
      }
      if (vivo) temporizador = setTimeout(latir, intervaloMs);
    }

    // Un encadenado de setTimeout y no un setInterval: así nunca se solapan dos
    // peticiones si una tarda más de lo normal.
    temporizador = setTimeout(latir, intervaloMs);

    function alVolver() {
      if (document.visibilityState === "visible") {
        clearTimeout(temporizador);
        void latir();
      }
    }
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      vivo = false;
      clearTimeout(temporizador);
      aborto.abort();
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [intervaloMs, router]);

  return null;
}
