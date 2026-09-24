// Un enlace que no vale: ni error feo ni pista de que exista un panel detrás.
//
// DUEÑO: carril B2.
import { LinkIcon } from "lucide-react";
import { elNegocio } from "@/lib/consultas";

export default async function EnlaceNoValido() {
  // Nada hardcodeado: el nombre y el teléfono salen de Ajustes.
  const negocio = await elNegocio();

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-md rounded-xl border bg-card px-6 py-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <LinkIcon className="size-5" />
        </span>
        <p className="mt-4 text-lg font-semibold tracking-tight text-marca">{negocio.nombre}</p>
        <h1 className="mt-3 text-base font-semibold">Este Enlace Ya No Está Disponible</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Puede que el presupuesto se haya retirado o que el enlace esté incompleto. Copia otra vez
          el enlace que te pasamos o llámanos y te lo mandamos de nuevo.
        </p>
        <p className="mt-4 text-sm font-medium">
          <a href={`tel:${negocio.telefono.replace(/\s/g, "")}`} className="cifra text-primary">
            {negocio.telefono}
          </a>
        </p>
      </div>
    </main>
  );
}
