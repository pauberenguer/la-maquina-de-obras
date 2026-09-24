"use client";
// La barra lateral del panel: 240 px, azul marino de Reformas Soler, el botón
// primario siempre visible y el badge naranja con los presupuestos parados.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import {
  FileTextIcon,
  HouseIcon,
  InboxIcon,
  LayoutTemplateIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  TagsIcon,
  UsersIcon,
} from "lucide-react";
import { Campana, type AvisoCampana } from "@/components/campana";
import { cerrarSesion } from "@/app/entrar/acciones";

const ENTRADAS = [
  { href: "/panel", etiqueta: "Inicio", icono: HouseIcon },
  { href: "/panel/solicitudes", etiqueta: "Solicitudes", icono: InboxIcon },
  { href: "/panel/presupuestos", etiqueta: "Presupuestos", icono: FileTextIcon },
  { href: "/panel/clientes", etiqueta: "Clientes", icono: UsersIcon },
  { href: "/panel/precios", etiqueta: "Precios", icono: TagsIcon },
  { href: "/panel/plantillas", etiqueta: "Plantillas", icono: LayoutTemplateIcon },
  { href: "/panel/ajustes", etiqueta: "Ajustes", icono: SettingsIcon },
] as const;

export function Sidebar({
  parados,
  solicitudes,
  avisos,
  sinLeer,
}: {
  /** Presupuestos sin respuesta desde hace más de 7 días. */
  parados: number;
  /** Solicitudes pendientes de convertir. */
  solicitudes: number;
  avisos: AvisoCampana[];
  sinLeer: number;
}) {
  const ruta = usePathname();

  return (
    <aside className="no-imprimir flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <Link href="/panel" className="min-w-0">
          <span className="block text-[15px] leading-tight font-semibold tracking-tight text-white">
            Reformas Soler
          </span>
          <span className="block text-[11px] leading-tight text-sidebar-foreground/60">
            La Máquina de Obras
          </span>
        </Link>
        <Campana avisos={avisos} sinLeer={sinLeer} />
      </div>

      <div className="px-3 pb-3">
        <Link
          href="/panel/nueva-visita"
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary),black_12%)]"
        >
          <PlusIcon className="size-4" />
          Nueva Solicitud
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {ENTRADAS.map(({ href, etiqueta, icono: Icono }) => {
          const activa = href === "/panel" ? ruta === "/panel" : ruta.startsWith(href);
          const badge =
            href === "/panel/presupuestos"
              ? parados
              : href === "/panel/solicitudes"
                ? solicitudes
                : 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                activa
                  ? "bg-white/10 font-medium text-white"
                  : "text-sidebar-foreground/75 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icono className="size-[18px] shrink-0" />
              <span className="flex-1 truncate">{etiqueta}</span>
              {badge > 0 && (
                <span
                  className={cn(
                    "cifra min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] leading-4 font-semibold",
                    href === "/panel/presupuestos" ? "bg-naranja text-marca" : "bg-white/15 text-white",
                  )}
                  title={
                    href === "/panel/presupuestos"
                      ? "Presupuestos sin respuesta desde hace más de 7 días"
                      : "Solicitudes pendientes de convertir"
                  }
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 flex items-center gap-2.5 rounded-lg px-2.5 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
          MS
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-tight font-medium text-white">Manolo</span>
          <span className="block truncate text-[11px] leading-tight text-sidebar-foreground/60">
            Reformas Soler
          </span>
        </span>
        <form action={cerrarSesion}>
          <button
            type="submit"
            title="Salir"
            aria-label="Salir del Panel"
            className="flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOutIcon className="size-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
