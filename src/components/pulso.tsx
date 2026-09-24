"use client";
// El panel en vivo: pregunta cada 3 segundos si algo ha cambiado y, si ha
// cambiado, refresca la página. Sin SSE ni websockets.
//
// DUEÑO: carril C. La fase 5 le engancha /api/pulso, que además llama a tick().
export function Pulso({ intervaloMs = 3000 }: { intervaloMs?: number }) {
  void intervaloMs;
  return null;
}
