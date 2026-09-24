// El pie de la web pública: los datos de la empresa, tal y como están en Ajustes.
import Link from "next/link";
import type { Negocio } from "@/lib/consultas";

export function PieWeb({ negocio, anyo }: { negocio: Negocio; anyo: number }) {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm sm:grid-cols-[1fr_auto] sm:px-6">
        <div>
          <p className="font-semibold text-marca">{negocio.nombre}</p>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            {negocio.direccion}
            <br />
            <a href={`tel:${negocio.telefono.replace(/\s/g, "")}`} className="cifra hover:text-foreground">
              {negocio.telefono}
            </a>
            {" · "}
            <a href={`mailto:${negocio.email}`} className="hover:text-foreground">
              {negocio.email}
            </a>
            <br />
            CIF {negocio.cif}
          </p>
        </div>
        <div className="flex flex-col justify-end gap-1 text-xs text-muted-foreground sm:items-end">
          <Link href="/entrar" className="hover:text-foreground">
            Acceso del Equipo
          </Link>
          <p>
            © {anyo} {negocio.nombre}
          </p>
        </div>
      </div>
    </footer>
  );
}
