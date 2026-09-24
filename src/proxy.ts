// La puerta del panel. En Next 16 el middleware se llama «proxy» y corre en
// Node.js antes de cada petición que encaje con el matcher.
//
// Solo hace criptografía (la firma y la caducidad de la cookie): no toca la
// base, así que es instantáneo. La segunda capa, exigirSesion(), vive dentro de
// cada Server Action del panel.
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, sesionVigente } from "@/lib/firma-sesion";
import { horaReal } from "@/lib/hora-real";

export function proxy(request: NextRequest) {
  const valor = request.cookies.get(COOKIE_SESION)?.value;
  if (sesionVigente(valor, horaReal())) return NextResponse.next();

  const { pathname, search } = request.nextUrl;

  // El polling del panel no es una página: responde 401 y el navegador lo deja estar.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "sin sesión" }, { status: 401 });
  }

  const entrar = new URL("/entrar", request.url);
  entrar.searchParams.set("desde", `${pathname}${search}`);
  return NextResponse.redirect(entrar);
}

export const config = {
  matcher: ["/panel", "/panel/:path*", "/api/pulso"],
};
