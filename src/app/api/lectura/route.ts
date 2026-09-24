// El buzón del tracking: aquí llega lo que manda el Rastreador de la página
// del cliente, por fetch al abrir y por sendBeacon al salir.
//
// Dos promesas con quien llama:
//   · responde siempre 200 y algo diminuto (sendBeacon ni lee la respuesta);
//   · un fallo aquí NUNCA rompe la página del cliente.
//
// El cuerpo que espera:
//   { token: string, apertura?: boolean, secciones?: [seccion, segundos][] }
//
// DUEÑO: carril C.
import { cookies, headers } from "next/headers";
import { userAgent, type NextRequest } from "next/server";
import { presupuestoPorToken } from "@/lib/consultas";
import {
  COOKIE_VISITANTE,
  VIDA_COOKIE_S,
  dispositivoDesdeTipo,
  nuevoVisitante,
  registrarLectura,
  seccionValida,
} from "@/lib/lecturas";
import { ipDe, ubicacionDe } from "@/lib/red";

/** Nunca se cachea: cada lectura es un hecho nuevo. */
export const dynamic = "force-dynamic";

const OK = { ok: true } as const;

type Cuerpo = {
  token?: unknown;
  apertura?: unknown;
  secciones?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    // sendBeacon manda el cuerpo como Blob: se lee como texto, no con .json(),
    // para no depender del content-type que ponga el navegador.
    const crudo = await request.text();
    if (!crudo) return Response.json(OK);

    let cuerpo: Cuerpo;
    try {
      cuerpo = JSON.parse(crudo) as Cuerpo;
    } catch {
      return Response.json({ ok: false });
    }

    const token = typeof cuerpo.token === "string" ? cuerpo.token : null;
    if (!token) return Response.json({ ok: false });

    const p = await presupuestoPorToken(token);
    if (!p) return Response.json({ ok: false });

    const cabeceras = await headers();
    const { isBot, device } = userAgent({ headers: cabeceras });
    // Un rastreador de enlaces (el previsualizador de WhatsApp, por ejemplo) no
    // es el cliente leyendo su presupuesto: no cuenta como visita.
    if (isBot) return Response.json(OK);

    const almacen = await cookies();
    const existente = almacen.get(COOKIE_VISITANTE)?.value;
    const visitanteId = existente || nuevoVisitante();
    if (!existente) {
      almacen.set(COOKIE_VISITANTE, visitanteId, {
        maxAge: VIDA_COOKIE_S,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }

    const { ciudad, pais } = ubicacionDe(cabeceras);
    const comun = {
      presupuestoId: p.id,
      visitanteId,
      ip: ipDe(cabeceras),
      ciudad,
      pais,
      dispositivo: dispositivoDesdeTipo(device.type),
    };

    if (cuerpo.apertura === true) {
      await registrarLectura(comun);
    }

    if (Array.isArray(cuerpo.secciones)) {
      for (const entrada of cuerpo.secciones) {
        if (!Array.isArray(entrada)) continue;
        const seccion = seccionValida(entrada[0]);
        const duracionS = Number(entrada[1]);
        if (!seccion || !Number.isFinite(duracionS)) continue;
        await registrarLectura({ ...comun, seccion, duracionS });
      }
    }

    return Response.json(OK);
  } catch (e) {
    // El tracking no puede tumbar la página del cliente: se registra y se calla.
    console.error("No se ha podido registrar la lectura:", (e as Error).message);
    return Response.json({ ok: false });
  }
}
