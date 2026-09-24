// La cabecera de la web pública de Reformas Soler: la empresa, no la herramienta.
import Link from "next/link";
import { PhoneIcon } from "lucide-react";

export function CabeceraWeb({ telefono, conBoton = true }: { telefono: string; conBoton?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="min-w-0">
          <span className="block text-lg leading-tight font-semibold tracking-tight text-marca">
            Reformas Soler
          </span>
          <span className="block text-[11px] leading-tight text-muted-foreground">
            Reformas en Barcelona
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`tel:${telefono.replace(/\s/g, "")}`}
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground sm:inline-flex"
          >
            <PhoneIcon className="size-4" />
            <span className="cifra">{telefono}</span>
          </a>
          {conBoton && (
            <Link
              href="/solicitar"
              className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary),black_12%)]"
            >
              Pedir Presupuesto
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
