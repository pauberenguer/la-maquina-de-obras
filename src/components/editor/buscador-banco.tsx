"use client";
// Añadir una línea desde el banco de precios. El precio y el margen los trae la
// partida: aquí no se escribe ningún importe.
import { useMemo, useState } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";
import { cn } from "cn";
import { formatoTitulo } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatoEuros, formatoPorcentaje, formatoUnidad } from "@/lib/formato";
import type { PartidaBanco } from "./tipos";

/** Sin tildes y en minúsculas, para que «albanileria» encuentre «Albañilería». */
function llano(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function BuscadorDelBanco({
  banco,
  onElegir,
  deshabilitado = false,
}: {
  banco: PartidaBanco[];
  onElegir: (partidaId: number) => void;
  deshabilitado?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const encontradas = useMemo(() => {
    const q = llano(busqueda.trim());
    const filtradas = q
      ? banco.filter((p) => llano(`${p.codigo} ${p.capitulo} ${p.nombre}`).includes(q))
      : banco;
    const grupos = new Map<string, PartidaBanco[]>();
    for (const p of filtradas) {
      const g = grupos.get(p.capitulo);
      if (g) g.push(p);
      else grupos.set(p.capitulo, [p]);
    }
    return [...grupos.entries()];
  }, [banco, busqueda]);

  const cuantas = encontradas.reduce((s, [, ps]) => s + ps.length, 0);

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) setBusqueda("");
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" size="sm" disabled={deshabilitado} />}
      >
        <PlusIcon />
        Añadir del Banco
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Añadir una Partida del Banco</DialogTitle>
          <DialogDescription>
            {banco.length} partidas activas. El precio y el margen los trae la partida: no se
            escribe ningún importe a mano.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código, capítulo o partida: alicatado, FON-03, pintura…"
            className="h-9 pl-8"
          />
        </div>

        <div className="-mx-1 max-h-[22rem] overflow-y-auto px-1">
          {cuantas === 0 ? (
            <p className="px-1 py-10 text-center text-sm text-muted-foreground">
              Ninguna partida del banco encaja con «{busqueda.trim()}». Si de verdad no existe,
              ciérralo y añade la línea a mano: saldrá en amarillo hasta que le pongas precio.
            </p>
          ) : (
            encontradas.map(([capitulo, partidas]) => (
              <section key={capitulo} className="mb-3 last:mb-0">
                <p className="sticky top-0 bg-popover py-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {formatoTitulo(capitulo)}
                </p>
                <ul>
                  {partidas.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onElegir(p.id);
                          setAbierto(false);
                          setBusqueda("");
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                          "hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none",
                        )}
                      >
                        <span className="cifra w-16 shrink-0 text-xs text-muted-foreground">
                          {p.codigo}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">{formatoTitulo(p.nombre)}</span>
                        <span className="cifra shrink-0 text-xs text-muted-foreground">
                          {formatoUnidad(p.unidad)}
                        </span>
                        <span className="cifra w-24 shrink-0 text-right text-sm font-medium">
                          {formatoEuros(p.precio)}
                        </span>
                        <span className="cifra w-14 shrink-0 text-right text-xs text-muted-foreground">
                          {formatoPorcentaje(p.margenObjetivo, 0)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
