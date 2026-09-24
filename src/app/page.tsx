// La web de Reformas Soler. La cara del negocio, no la de la herramienta: lo que
// hacen, cómo trabajan y cómo pedirles presupuesto.
//
// TODO lo que enseña sale de la base: los datos de la empresa de Ajustes y los
// capítulos del banco de precios. Si Manolo cambia algo, la web cambia con él.
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  BrickWallIcon,
  ChefHatIcon,
  CircleCheckIcon,
  ClipboardListIcon,
  DoorOpenIcon,
  DropletIcon,
  FanIcon,
  FileCheckIcon,
  Grid3x3Icon,
  HammerIcon,
  HardHatIcon,
  PaintRollerIcon,
  PhoneIcon,
  RulerIcon,
  WrenchIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import { CabeceraWeb } from "@/components/web/cabecera";
import { PieWeb } from "@/components/web/pie";
import { datosDeLaWeb } from "@/lib/consultas";
import { formatoTitulo } from "@/lib/formato";
import { ahora, cargarReloj } from "@/lib/reloj";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reformas Soler · Reformas en Barcelona",
  description:
    "Reformas de baños, cocinas y pisos completos en Barcelona. Vamos a ver la obra y al día siguiente tienes el presupuesto desglosado partida por partida.",
};

/** El icono de cada capítulo del banco. Lo que no esté aquí, lleva el genérico. */
const ICONOS: Record<string, LucideIcon> = {
  demoliciones: HammerIcon,
  albañilería: BrickWallIcon,
  fontanería: DropletIcon,
  electricidad: ZapIcon,
  "alicatados y solados": Grid3x3Icon,
  carpintería: DoorOpenIcon,
  pintura: PaintRollerIcon,
  cocina: ChefHatIcon,
  climatización: FanIcon,
  "gestión y varios": ClipboardListIcon,
};

const PASOS = [
  {
    icono: RulerIcon,
    titulo: "Vamos a Ver la Obra",
    texto: "Pasamos por tu casa, vemos lo que quieres hacer y tomamos las medidas. Sin compromiso.",
  },
  {
    icono: FileCheckIcon,
    titulo: "Presupuesto en 24 Horas",
    texto:
      "Te llega un enlace con el presupuesto desglosado: cada partida con su medición y su precio, y los opcionales para que elijas tú.",
  },
  {
    icono: HardHatIcon,
    titulo: "Empezamos la Obra",
    texto: "Lo aceptas firmando desde el móvil y fijamos juntos la fecha de inicio.",
  },
];

const PROMESAS = [
  "Desglosado por capítulos y partidas",
  "Con la medición y el precio de cada partida",
  "Con fecha de validez, para que no haya sorpresas",
  "Lo firmas desde el móvil, sin papeles",
];

export default async function Web() {
  await cargarReloj();
  const { negocio, capitulos, obrasContratadas, clientes, partidas } = await datosDeLaWeb();
  const telefono = negocio.telefono;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CabeceraWeb telefono={telefono} />

      <main className="flex-1">
        {/* ------------------------------------------------------------ portada */}
        <section className="bg-marca text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-24">
            <div>
              <p className="text-sm font-medium text-white/60">Reformas en Barcelona</p>
              <h1 className="mt-3 text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
                El Presupuesto de Tu Reforma, en 24 Horas
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">
                Vamos a ver la obra, la medimos y al día siguiente tienes el presupuesto desglosado
                partida por partida, con el precio de cada una. Sin esperar semanas.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/solicitar"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-marca transition-colors hover:bg-white/90"
                >
                  Pedir Presupuesto
                  <ArrowRightIcon className="size-4" />
                </Link>
                <a
                  href={`tel:${telefono.replace(/\s/g, "")}`}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/25 px-5 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  <PhoneIcon className="size-4" />
                  <span>
                    Llamar al <span className="cifra">{telefono}</span>
                  </span>
                </a>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm font-semibold">Así Te Llega el Presupuesto</p>
              <ul className="mt-4 space-y-3">
                {PROMESAS.map((promesa) => (
                  <li key={promesa} className="flex items-start gap-2.5 text-sm text-white/80">
                    <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-naranja" />
                    {promesa}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- tira de confianza */}
        <section className="border-b bg-card">
          <dl className="mx-auto grid max-w-6xl grid-cols-3 divide-x px-4 py-6 sm:px-6">
            {[
              { valor: clientes, etiqueta: "Clientes" },
              { valor: obrasContratadas, etiqueta: "Obras Contratadas" },
              { valor: partidas, etiqueta: "Partidas con Precio" },
            ].map((dato) => (
              <div key={dato.etiqueta} className="flex flex-col justify-between px-3 text-center first:pl-0 last:pr-0">
                <dt className="text-xs text-muted-foreground sm:text-sm">{dato.etiqueta}</dt>
                <dd className="cifra mt-1 text-2xl font-semibold text-marca sm:text-3xl">{dato.valor}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ------------------------------------------------------- lo que hacen */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Lo Que Hacemos</h2>
            <p className="mt-2 text-muted-foreground">
              Baños, cocinas y pisos completos, de la demolición a la limpieza final. Cada capítulo
              tiene sus partidas con precio: nada se presupuesta a ojo.
            </p>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capitulos.map((capitulo) => {
              const Icono = ICONOS[capitulo.nombre.toLowerCase()] ?? WrenchIcon;
              return (
                <li key={capitulo.nombre} className="rounded-xl border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-marca">
                      <Icono className="size-[18px]" />
                    </span>
                    <div>
                      <h3 className="font-semibold">{formatoTitulo(capitulo.nombre)}</h3>
                      <p className="text-xs text-muted-foreground">
                        <span className="cifra">{capitulo.partidas}</span>{" "}
                        {capitulo.partidas === 1 ? "partida" : "partidas"}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                    {capitulo.ejemplos.map((ejemplo) => (
                      <li key={ejemplo} className="leading-snug">
                        {formatoTitulo(ejemplo)}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ---------------------------------------------------- cómo trabajamos */}
        <section className="border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Cómo Trabajamos</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {PASOS.map((paso, i) => (
                <li key={paso.titulo}>
                  <div className="flex items-center gap-3">
                    <span className="cifra flex size-9 items-center justify-center rounded-full bg-marca text-sm font-semibold text-white">
                      {i + 1}
                    </span>
                    <paso.icono className="size-5 text-marca/70" />
                  </div>
                  <h3 className="mt-4 font-semibold">{paso.titulo}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{paso.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------------ llamada */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-6 rounded-xl bg-marca px-6 py-10 text-white sm:flex-row sm:items-center sm:px-10">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">¿Hablamos de Tu Obra?</h2>
              <p className="mt-2 max-w-lg text-white/75">
                Cuéntanos qué quieres hacer y Manolo te llama para concertar la visita.
              </p>
            </div>
            <Link
              href="/solicitar"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-marca transition-colors hover:bg-white/90"
            >
              Pedir Presupuesto
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <PieWeb negocio={negocio} anyo={ahora().getFullYear()} />
    </div>
  );
}
