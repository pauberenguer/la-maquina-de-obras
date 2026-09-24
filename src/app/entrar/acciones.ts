"use server";
// Entrar al panel con la contraseña. Tras entrar se vuelve a donde se iba, pero
// solo si es una ruta del panel: el formulario no puede redirigir a otra web.
import { redirect } from "next/navigation";
import { entrarConContrasena, salir } from "@/lib/sesion";

export type EstadoEntrar = { mensaje: string } | null;

function destinoSeguro(desde: FormDataEntryValue | null): string {
  const ruta = typeof desde === "string" ? desde : "";
  return ruta.startsWith("/panel") && !ruta.startsWith("//") ? ruta : "/panel";
}

export async function entrar(_previo: EstadoEntrar, datos: FormData): Promise<EstadoEntrar> {
  const contrasena = String(datos.get("contrasena") ?? "");
  if (!contrasena) return { mensaje: "Escribe la contraseña." };

  const resultado = await entrarConContrasena(contrasena);
  if (!resultado.ok) return { mensaje: resultado.mensaje };
  redirect(destinoSeguro(datos.get("desde")));
}

export async function cerrarSesion(): Promise<void> {
  await salir();
  redirect("/entrar");
}
