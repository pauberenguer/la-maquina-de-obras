"use client";
// La campana de avisos del panel, con el contador de no leídos.
import { useState, useTransition } from "react";
import { BellIcon, CheckCheckIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { marcarLeidos } from "@/app/panel/acciones";

export type AvisoCampana = {
  id: number;
  texto: string;
  leido: boolean;
  ts: string;
  presupuestoId: number | null;
};

export function Campana({ avisos, sinLeer }: { avisos: AvisoCampana[]; sinLeer: number }) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, empezar] = useTransition();

  return (
    <DropdownMenu open={abierto} onOpenChange={setAbierto}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={sinLeer ? `${sinLeer} avisos sin leer` : "Avisos"}
            className="relative flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <BellIcon className="size-[18px]" />
            {sinLeer > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-naranja px-1 text-[10px] leading-4 font-semibold text-marca">
                {sinLeer}
              </span>
            )}
          </button>
        }
      />
      <DropdownMenuContent align="start" sideOffset={8} className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Avisos</span>
          {sinLeer > 0 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pendiente}
              onClick={() => empezar(() => void marcarLeidos())}
              className="h-7 gap-1.5 px-2 text-xs"
            >
              <CheckCheckIcon className="size-3.5" />
              Marcar como Leídos
            </Button>
          )}
        </div>
        {avisos.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Aquí te avisamos en cuanto un cliente abra un presupuesto o salga un seguimiento.
          </p>
        ) : (
          <ScrollArea className="max-h-[360px]">
            <ul className="divide-y">
              {avisos.map((aviso) => (
                <li
                  key={aviso.id}
                  className={cn("px-3 py-2.5 text-sm", !aviso.leido && "bg-naranja-suave/60")}
                >
                  <p className="leading-snug">{aviso.texto}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{aviso.ts}</p>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
