// El latido, a mano. El panel ya lo dispara en cada polling; este endpoint
// existe para poder forzarlo desde fuera (y para que un cron tenga a dónde
// llamar).
//
// No es público: dispara el motor (seguimientos, caducidades y avisos). Con
// CRON_SECRET exige la cabecera «Authorization: Bearer <secreto>», que es la
// que manda el cron de Vercel; sin secreto, solo responde en desarrollo.
//
// DUEÑO: carril C.
import { igualesEnTiempoConstante } from "@/lib/firma-sesion";
import { tick } from "@/lib/tick";

export const dynamic = "force-dynamic";

function autorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return process.env.NODE_ENV !== "production";
  return igualesEnTiempoConstante(req.headers.get("authorization") ?? "", `Bearer ${secreto}`);
}

async function latir(req: Request) {
  if (!autorizado(req)) return Response.json({ error: "no autorizado" }, { status: 401 });
  const resultado = await tick();
  return Response.json(resultado, {
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(req: Request) {
  return latir(req);
}

export async function POST(req: Request) {
  return latir(req);
}
