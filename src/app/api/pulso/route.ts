// El latido del panel. El navegador pregunta cada 3 segundos «¿ha cambiado
// algo?» y aquí se responde con un número: si no es el mismo que el anterior,
// la página se refresca.
//
// Además es el reloj del producto: en cada latido se ejecuta tick() —las tareas
// vencidas y lo que haya caducado— y se sueltan los avisos de aperturas que se
// quedaron agrupados. En producción esto lo haría un cron cada minuto; aquí, el
// propio panel abierto.
//
// DUEÑO: carril C.
import { avisarAperturasPendientes } from "@/lib/avisos";
import { versionDelPanel } from "@/lib/consultas";
import { tick } from "@/lib/tick";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await tick();
    await avisarAperturasPendientes();
  } catch (e) {
    // Un latido que falla no puede dejar el panel congelado: se registra, se
    // devuelve la versión que haya y el siguiente latido lo vuelve a intentar.
    console.error("El latido ha fallado:", (e as Error).message);
  }

  return Response.json(
    { version: await versionDelPanel() },
    { headers: { "cache-control": "no-store" } },
  );
}
