// La puerta del panel: una contraseña y nada más. Fuera del layout del panel.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormularioEntrar } from "@/components/entrar/formulario";
import { accesoConfigurado, haySesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acceso al Panel · Reformas Soler",
  robots: { index: false, follow: false },
};

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const { desde } = await searchParams;
  const destino = typeof desde === "string" && desde.startsWith("/panel") ? desde : "/panel";
  if (await haySesion()) redirect(destino);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-marca px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link href="/" className="text-xl font-semibold tracking-tight text-white">
            Reformas Soler
          </Link>
          <p className="mt-1 text-sm text-white/60">La Máquina de Obras</p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-lg">
          <h1 className="text-lg font-semibold tracking-tight">Acceso al Panel</h1>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            El panel de Reformas Soler es privado. Escribe la contraseña del equipo para entrar.
          </p>
          {accesoConfigurado() ? (
            <FormularioEntrar desde={destino} />
          ) : (
            <p role="alert" className="rounded-lg bg-perdido-fondo px-3 py-2.5 text-sm text-perdido">
              El acceso no está configurado: faltan <span className="cifra">PANEL_PASSWORD</span> o{" "}
              <span className="cifra">PANEL_SECRET</span> en las variables de entorno.
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-white/50">
          <Link href="/" className="hover:text-white/80">
            Volver a la Web de Reformas Soler
          </Link>
        </p>
      </div>
    </main>
  );
}
