// HOY: la lista accionable de Inicio. Quién ha abierto qué y cuándo, qué
// seguimientos salen hoy, qué caduca en 3 días o menos y qué caducado se ha
// vuelto a abrir. Todo sale de la base, nada está escrito a mano.
//
// El orden no es casual: primero lo que hace ganar dinero hoy (un caducado que
// alguien vuelve a abrir es la mejor llamada del día), luego lo que acaba de
// pasar, y al final lo que vence. Cada fila lleva a su ficha.
//
// DUEÑO: carril C.
import Link from "next/link";
import {
  ChevronRightIcon,
  ClockAlertIcon,
  EyeIcon,
  RotateCcwIcon,
  SendIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Importe } from "@/components/importe";
import {
  aperturasDeHoy,
  caducanPronto,
  expiradosReabiertos,
  seguimientosDeHoy,
} from "@/lib/consultas";
import { ahora, cargarReloj } from "@/lib/reloj";
import {
  formatoDiasRestantes,
  formatoDispositivo,
  formatoHora,
  formatoRelativo,
  formatoTitulo,
  formatoUbicacion,
  formatoVisita,
} from "@/lib/formato";

type Fila = {
  clave: string;
  icono: LucideIcon;
  tono: "azul" | "violeta" | "ambar" | "naranja";
  texto: React.ReactNode;
  detalle: string;
  importe: number;
  href: string;
  /** Lo que se ordena: menor, más arriba. */
  prioridad: number;
};

const TONOS = {
  azul: "bg-enviado-fondo text-enviado",
  violeta: "bg-visto-fondo text-visto",
  ambar: "bg-conversacion-fondo text-conversacion",
  naranja: "bg-naranja-suave text-conversacion",
};

/** Los cuatro bloques de HOY, por lo que importa atenderlos. */
const REABIERTO = 0;
const APERTURA = 1_000_000;
const SEGUIMIENTO = 2_000_000;
const CADUCIDAD = 3_000_000;

export async function Hoy() {
  await cargarReloj();
  const [reabiertos, aperturas, seguimientos, caducan] = await Promise.all([
    expiradosReabiertos(),
    aperturasDeHoy(),
    seguimientosDeHoy(),
    caducanPronto(),
  ]);
  const hoy = ahora();
  const filas: Fila[] = [];

  // Un caducado que alguien vuelve a abrir: señal de compra, lo primero del día.
  for (const p of reabiertos) {
    filas.push({
      clave: `reabierto-${p.id}`,
      icono: RotateCcwIcon,
      tono: "naranja",
      texto: (
        <>
          <strong className="font-medium">{p.clienteNombre}</strong> ha vuelto a abrir un
          presupuesto caducado
        </>
      ),
      detalle: `${formatoRelativo(p.ultimaLectura, hoy)} · ${formatoTitulo(p.titulo)} · es una señal de compra: llámale`,
      importe: p.total,
      href: `/panel/presupuestos/${p.id}`,
      prioridad: REABIERTO - p.ultimaLectura.getTime() / 1000,
    });
  }

  // Lo que acaba de pasar, lo más reciente arriba.
  for (const a of aperturas) {
    filas.push({
      clave: `apertura-${a.presupuestoId}-${a.ts.getTime()}`,
      icono: EyeIcon,
      tono: "violeta",
      texto: (
        <>
          <strong className="font-medium">{a.clienteNombre}</strong> ha abierto su presupuesto de{" "}
          {formatoTitulo(a.titulo)}
        </>
      ),
      detalle: `${formatoRelativo(a.ts, hoy)} · ${formatoHora(a.ts)} · ${formatoVisita(a.visitaN)} · ${formatoDispositivo(a.dispositivo)} · ${formatoUbicacion(a.ciudad, a.pais)}`,
      importe: a.total,
      href: `/panel/presupuestos/${a.presupuestoId}`,
      prioridad: APERTURA - a.ts.getTime() / 1000,
    });
  }

  for (const s of seguimientos) {
    const numero = s.tipo === "seguimiento_1" ? 1 : s.tipo === "seguimiento_2" ? 2 : 3;
    filas.push({
      clave: `tarea-${s.id}`,
      icono: SendIcon,
      tono: "azul",
      texto: (
        <>
          Hoy sale el <strong className="font-medium">seguimiento {numero}</strong> a{" "}
          {s.clienteNombre}
        </>
      ),
      detalle: `${formatoHora(s.ejecutarEn)} · ${formatoRelativo(s.ejecutarEn, hoy)} · ${s.asunto}`,
      importe: s.total,
      href: `/panel/presupuestos/${s.presupuestoId}`,
      prioridad: SEGUIMIENTO + s.ejecutarEn.getTime() / 1000,
    });
  }

  for (const p of caducan) {
    filas.push({
      clave: `caduca-${p.id}`,
      icono: ClockAlertIcon,
      tono: "ambar",
      texto: (
        <>
          El presupuesto de <strong className="font-medium">{p.clienteNombre}</strong> caduca en{" "}
          {formatoDiasRestantes(p.validoHasta, hoy)}
        </>
      ),
      detalle: `${formatoTitulo(p.titulo)} · ${p.direccionObra}`,
      importe: p.total,
      href: `/panel/presupuestos/${p.id}`,
      prioridad: CADUCIDAD + (p.validoHasta?.getTime() ?? 0) / 1000,
    });
  }

  filas.sort((a, b) => a.prioridad - b.prioridad);

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex items-baseline justify-between gap-3 border-b px-5 py-3.5">
        <h2 className="font-semibold">Hoy</h2>
        <span className="text-xs text-muted-foreground">
          {filas.length === 0
            ? "sin movimientos"
            : `${filas.length} ${filas.length === 1 ? "cosa que atender" : "cosas que atender"}`}
        </span>
      </header>

      {filas.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Hoy no hay aperturas, ni seguimientos programados, ni presupuestos a punto de caducar.
          Cuando los haya, aparecerán aquí con el cliente, la obra y el importe.
        </p>
      ) : (
        <ul className="divide-y">
          {filas.map((fila) => (
            <li key={fila.clave}>
              <Link
                href={fila.href}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary/60"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    TONOS[fila.tono],
                  )}
                >
                  <fila.icono className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{fila.texto}</span>
                  <span className="block truncate text-xs text-muted-foreground">{fila.detalle}</span>
                </span>
                <Importe centimos={fila.importe} corto className="text-sm font-medium" />
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
