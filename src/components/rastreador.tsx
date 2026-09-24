"use client";
// El tracking de la página del cliente: avisa de la apertura al cargar y manda
// el tiempo de cada sección al salir de ella y al cerrar la pestaña.
//
// La página pública marca sus bloques con data-seccion="cabecera|capitulos|
// opcionales|total|condiciones|firma". Si no encuentra ninguno, registra la
// apertura y calla: este componente NUNCA puede romper la página del cliente.
//
// DUEÑO: carril C.
import { useEffect } from "react";

const RUTA = "/api/lectura";
/** Cada cuánto se vacía el buzón sin esperar a que el cliente cierre. */
const VOLCADO_MS = 15000;

/** Aperturas ya registradas en esta carga de página (React las monta dos veces en desarrollo). */
const yaAbiertos = new Set<string>();

type Acumulado = Map<string, number>;

export function Rastreador({ token }: { token: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    /** Segundos leídos por sección, pendientes de mandar. */
    const buzon: Acumulado = new Map();
    /** Cuándo entró en pantalla cada sección que sigue visible. */
    const desde = new Map<string, number>();

    function anotar(seccion: string, ms: number) {
      if (ms < 1000) return; // un vistazo de scroll no es una lectura
      buzon.set(seccion, (buzon.get(seccion) ?? 0) + ms / 1000);
    }

    /** Cierra el cronómetro de todo lo que siga visible. */
    function cerrarAbiertas() {
      const t = performance.now();
      for (const [seccion, entrada] of desde) anotar(seccion, t - entrada);
      desde.clear();
    }

    function vaciarBuzon(): [string, number][] {
      const secciones: [string, number][] = [];
      for (const [seccion, segundos] of buzon) {
        const redondeado = Math.round(segundos);
        if (redondeado >= 1) secciones.push([seccion, redondeado]);
      }
      buzon.clear();
      return secciones;
    }

    /** El envío normal, mientras la página está viva. */
    async function mandar(cuerpo: Record<string, unknown>) {
      try {
        await fetch(RUTA, {
          method: "POST",
          body: JSON.stringify({ token, ...cuerpo }),
          keepalive: true,
        });
      } catch {
        // Sin conexión o pestaña cerrándose: el tracking se pierde y ya está.
      }
    }

    /**
     * El envío de despedida: sendBeacon sobrevive al cierre de la pestaña.
     * Vaciar el buzón lo hace idempotente, así que da igual que lo disparen a
     * la vez `visibilitychange` y `pagehide`.
     */
    function despedirse() {
      cerrarAbiertas();
      const secciones = vaciarBuzon();
      if (secciones.length === 0) return;
      const cuerpo = JSON.stringify({ token, secciones });
      try {
        if (!navigator.sendBeacon?.(RUTA, new Blob([cuerpo], { type: "text/plain" }))) {
          void mandar({ secciones });
        }
      } catch {
        void mandar({ secciones });
      }
    }

    /* ----------------------------------------------------------- apertura */
    if (!yaAbiertos.has(token)) {
      yaAbiertos.add(token);
      void mandar({ apertura: true });
    }

    /* ------------------------------------------- el reloj de cada sección */
    let observador: IntersectionObserver | undefined;
    let reintento: ReturnType<typeof setTimeout> | undefined;

    function observarBloques() {
      const bloques = document.querySelectorAll<HTMLElement>("[data-seccion]");
      if (bloques.length === 0) return false;
      observador = new IntersectionObserver(
        (entradas) => {
          const t = performance.now();
          for (const entrada of entradas) {
            const seccion = entrada.target.getAttribute("data-seccion");
            if (!seccion) continue;
            if (entrada.isIntersecting) {
              desde.set(seccion, t);
            } else {
              const inicio = desde.get(seccion);
              if (inicio !== undefined) {
                anotar(seccion, t - inicio);
                desde.delete(seccion);
              }
            }
          }
        },
        // Media sección a la vista ya cuenta como que la está leyendo.
        { threshold: 0.5 },
      );
      for (const bloque of bloques) observador.observe(bloque);
      return true;
    }

    if (typeof IntersectionObserver !== "undefined" && !observarBloques()) {
      // Todavía no hay bloques marcados: puede que la página los pinte un
      // instante después. Se reintenta una vez y, si siguen sin estar, se
      // registra solo la apertura y punto.
      reintento = setTimeout(observarBloques, 800);
    }

    /* ------------------------------------------------------- los volcados */
    const periodico = setInterval(() => {
      // Se cierran y se vuelven a abrir los cronómetros para no perder el rato
      // de una sección que lleva mucho a la vista.
      const t = performance.now();
      for (const [seccion, entrada] of desde) {
        anotar(seccion, t - entrada);
        desde.set(seccion, t);
      }
      const secciones = vaciarBuzon();
      if (secciones.length > 0) void mandar({ secciones });
    }, VOLCADO_MS);

    function alOcultarse() {
      if (document.visibilityState === "hidden") despedirse();
    }
    document.addEventListener("visibilitychange", alOcultarse);
    window.addEventListener("pagehide", despedirse);

    return () => {
      clearInterval(periodico);
      clearTimeout(reintento);
      observador?.disconnect();
      document.removeEventListener("visibilitychange", alOcultarse);
      window.removeEventListener("pagehide", despedirse);
      despedirse();
    };
  }, [token]);

  return null;
}
