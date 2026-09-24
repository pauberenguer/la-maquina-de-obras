// El latido del producto. Sin procesos en segundo plano ni setInterval: tick()
// ejecuta las tareas vencidas y marca como Expirado lo que ha pasado su fecha.
// Lo llama el endpoint de polling en cada petición y el botón del reloj de demo.
// En producción lo llamaría un cron cada minuto; aquí, el propio panel.
//
// DUEÑO: carril C. El cuerpo completo (ejecutar seguimientos, avisar, email)
// llega en la fase 6; aquí queda la firma y el latido vacío.
import type { ResultadoTick } from "./tipos";

export async function tick(): Promise<ResultadoTick> {
  return { tareas: 0, expirados: 0 };
}
