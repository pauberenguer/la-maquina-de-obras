# La Máquina de Obras

Sistema de presupuestos y seguimiento para **Reformas Soler** (empresa de
reformas de 8 personas en Barcelona; el usuario es «Manolo · Reformas Soler»).
El jefe dicta la visita y sale un presupuesto con su marca en minutos; cada
presupuesto enviado avisa cuando el cliente lo lee, se persigue solo, caduca con
fecha, se firma en la propia página y se mide en un panel con euros reales.

## Stack

- Next.js 16 (App Router, `src/`, Turbopack) · TypeScript estricto · Tailwind v4.
  Next 16 cambia cosas respecto a lo que conoces: antes de escribir código, lee
  `AGENTS.md` y la guía que corresponda en `node_modules/next/dist/docs/`.
- shadcn: los componentes ya están en `src/components/ui/`. **No son los de
  Radix: están sobre `@base-ui/react`.** Cambia la API (se usa `render={<button/>}`
  en vez de `asChild`, `Tabs.Tab`/`Tabs.Panel` con `value`…): lee el componente
  antes de usarlo. Iconos de `lucide-react`. Fuente Geist local
  (`geist/font/sans`), sin fuentes remotas.
- libSQL con Drizzle (`drizzle-orm/libsql` + `@libsql/client`): en local, el
  fichero `data/demo.db`; en producción, Turso. Esquema en `src/db/schema.ts`.
  Sin migraciones: `npm run db:push` sincroniza el esquema con la base de
  `DATABASE_URL`. **El acceso a datos es asíncrono**: todo lo que lee o escribe
  la base devuelve una promesa y se espera; las lecturas independientes, en
  paralelo con `Promise.all` (en Turso cada ida y vuelta cuesta).
  **El dinero se guarda y se mueve SIEMPRE en céntimos enteros**, nunca en coma
  flotante; solo se divide entre 100 al formatear.
- Despliegue en Vercel (plan gratuito, región `dub1`, junto a la base de Turso
  en Irlanda).
- IA: SDK oficial `openai`, Responses API. Modelo `gpt-5.6-terra`
  (`OPENAI_MODEL`), esfuerzo `high` (`OPENAI_EFFORT`), salida estructurada con
  `client.responses.parse` + `zodTextFormat` (de `openai/helpers/zod`). Solo
  en servidor.

## Comandos

- `npm run dev` — servidor de desarrollo en http://localhost:3000
- `npm run check` — `tsc --noEmit`; sin errores antes de enseñar nada
- `npm run reset` — vacía la base (borra sus tablas, no el fichero), aplica el
  esquema, importa el banco de precios y carga el seed. Al terminar comprueba que
  las cifras de las diapositivas cuadran al céntimo y aborta si no
- `npm run db:push` — aplica el esquema a la base sin migraciones
- `npm run humo` — prueba las cosas externas: API de OpenAI, Telegram, `APP_URL` y Turso

## Estructura

```
src/app/page.tsx          la landing de Reformas Soler (pública)
src/app/solicitar/        pedir presupuesto (público)
src/app/entrar/           la contraseña del panel
src/app/panel/            el panel de Manolo, con la barra lateral (privado)
src/app/p/[token]/        página pública del presupuesto (sin nada del panel)
src/proxy.ts              protege /panel/* (en Next 16 el middleware es «proxy»)
src/app/api/              route handlers: tracking, polling, tick, ia
src/db/                   index.ts (conexión) · schema.ts · seed.ts · reset.ts
src/lib/                  reloj.ts · importes.ts · formato.ts · ia.ts · telegram.ts · tick.ts
                          sesion.ts · firma-sesion.ts · limites.ts · solicitud-web.ts · solicitudes.ts
src/components/           ui/ (shadcn, no se tocan) · el resto, componentes propios
data/                     base-precios.csv · demo.db (ignorado por git)
```

## Reglas de negocio innegociables

1. **Nunca se inventa un precio.** Solo existen los del banco (tabla `partida`)
   o los que Manolo escriba a mano. Una línea sin partida del banco es
   amarilla y no tiene precio hasta que él lo ponga.
2. **Todo lo que no es lenguaje es determinista:** importes, estados, tiempos,
   caducidad, tracking y métricas. La IA solo entiende texto libre, casa
   conceptos con el banco y redacta seguimientos.
3. El **importe** de un presupuesto es el total con IVA. El cálculo vive en
   `src/lib/importes.ts` y lo usan el editor, la página pública y el seed.
   Nadie recalcula por su cuenta.
4. **Estados:** `borrador → enviado → visto → en_conversacion → ganado |
   perdido (con motivo) | expirado`. Ganado, Perdido y Expirado cancelan las
   tareas pendientes. La firma pasa a Ganado.
5. **Seguimientos** a los 3, 7 y 14 días del envío; máximo tres; se paran si el
   cliente responde o acepta; el último menciona la caducidad real.
6. Los € del panel son **sumas de presupuestos reales**, nunca estimaciones, y
   cada métrica enseña su fórmula.

## Convenciones técnicas

- La hora se lee SIEMPRE con `ahora()` de `src/lib/reloj.ts`: hora real más el
  desplazamiento guardado en `negocio.reloj_offset_ms`. `new Date()` y
  `Date.now()` solo dentro de ese fichero. `ahora()` es síncrona: el
  desplazamiento vive en memoria y **se carga con `await cargarReloj()` al
  empezar cada petición** (página, layout, route handler, Server Action,
  script). Las consultas que dependen de la hora lo cargan por sí mismas.
- La única excepción es `horaReal()` (`src/lib/hora-real.ts`): la sesión del
  panel y los límites por IP se miden con la hora real, para que mover el reloj
  de la demo no cierre la sesión ni levante un bloqueo.
- `src/lib/reloj.ts` toca la base, así que NO puede importarse desde un
  componente cliente. `src/lib/formato.ts` y `src/lib/tiempo.ts` sí son seguros
  en el navegador: por eso `formatoRelativo()` y `formatoDiasRestantes()` reciben
  la hora como segundo argumento, y quien llama la saca de `ahora()`.
- Sin procesos en segundo plano ni `setInterval`: `tick()` (`src/lib/tick.ts`)
  ejecuta las tareas vencidas y expira lo caducado, y se llama desde el
  endpoint de polling y al mover el reloj de demo.
- El panel se refresca por polling cada 3 s. Sin SSE ni websockets.
- Un solo cliente de libSQL (singleton en `globalThis`); en el fichero local,
  WAL y `busy_timeout` de 5 s.
- Las escrituras que deciden algo van condicionadas en el propio UPDATE
  (`cambiarEstado()` solo cambia si el estado sigue siendo el leído; las tareas
  se reclaman con `estado = 'pendiente'`): con la base asíncrona, dos
  peticiones pueden cruzarse entre la lectura y la escritura.
- **Acceso**: una sola contraseña (`PANEL_PASSWORD`). `src/proxy.ts` protege
  `/panel/*` y `/api/pulso`; además, **cada Server Action del panel empieza con
  `await exigirSesion()`**, porque una acción se puede invocar desde cualquier
  ruta. Públicos: `/`, `/solicitar`, `/p/[token]`, `/api/lectura` y
  `/api/publico/*`.
- **Todo lo que se exporta de un fichero `"use server"` es una acción que se
  puede invocar desde internet**, aunque ninguna pantalla la use. En esos
  ficheros solo hay envoltorios que empiezan por `exigirSesion()`; el trabajo de
  verdad vive en `src/lib/` (por ejemplo, `src/lib/solicitudes.ts`).
- La IA nunca se llama desde el navegador, y siempre con salida estructurada
  validada por Zod: nunca se parsea texto libre del modelo.
- Telegram por `fetch` al Bot API, agrupado: máximo un aviso por minuto y
  presupuesto (`presupuesto.ultimo_aviso_en`). Si faltan las claves, solo la
  campana del panel.
- Interfaz en castellano. Importes con `formatoEuros()` y fechas con
  `formatoFecha()` de `src/lib/formato.ts` (`es-ES`, `Europe/Madrid`).
- **Title Case castellano** en botones, títulos, titulines, etiquetas, cabeceras
  de tabla y nombres que vienen de la base («Enviar al Cliente», «Reforma de
  Baño»). Los datos se pintan con `formatoTitulo()`; la prosa, no.
- Base UI: un `<Button render={<Link/>}>` lleva `nativeButton={false}`, o la
  consola avisa de que un botón no es un `<button>`.
- Página pública `/p/[token]`: primero móvil, sin layout del panel, `@media
  print` para el PDF (`window.print()`), firma en un canvas propio.
- Mutaciones con Server Actions o route handlers; componentes cliente solo
  donde hay interacción.

## Prohibido

- `npm install`, `npx shadcn add` o cualquier dependencia nueva. Lo que falte
  se escribe a mano.
- Leer, imprimir o pegar `.env.local`. Las claves se leen con `process.env`.
- Borrar `data/demo.db` o ejecutar `npm run reset` sin que Pau lo pida.
- Cambiar el esquema sin decirlo. Migraciones improvisadas.
- Arrancar o reiniciar el servidor de desarrollo: lo tiene Pau en otra terminal
  en `http://localhost:3000`. Si hace falta reiniciarlo, se le dice.
- Lorem ipsum, «próximamente», textos en inglés en la interfaz.

## Cómo trabajamos

- Por fases y en paralelo, según el plan aprobado, sin parar. Al cerrar una
  fase: qué hay, la URL para probarlo y qué falta. Y se sigue: la única
  aprobación es la del plan.
- Antes de enseñar nada: `npm run check` sin errores y la ruta cargando sin
  errores en la consola del navegador ni del servidor.
- Commit al cerrar cada fase: `Fase N · título`.
- Subagentes siempre con Opus 5 y esfuerzo alto (forks o `model: opus`), con
  ficheros disjuntos. El esquema, la navegación, el layout, `globals.css`, los
  componentes compartidos y `src/lib/` los toca solo la sesión principal, con
  tres excepciones de dueño único:
  - **carril A** (la entrada): `src/lib/ia.ts`, `src/app/solicitar/` y
    `components/web/formulario-solicitud.tsx`;
  - **carril C** (el motor): `src/lib/tick.ts`, `telegram.ts`, `avisos.ts`,
    `frases.ts`, `src/app/api/`, `components/{pulso,rastreador}.tsx`,
    `components/inicio/hoy.tsx`, `components/presupuesto/{actividad,seguimientos}.tsx`;
  - **carril B** (el documento): `components/presupuesto/acciones.tsx`,
    la ruta del editor, `src/app/p/[token]/` y `src/app/api/publico/`.
- El estilo no se improvisa: la referencia visual del panel es Holded (las cinco
  capturas de `referencias/holded/`, se miran antes de diseñar), los tokens de
  `globals.css` y los componentes compartidos (`EstadoBadge`, `Importe`, `Kpi`,
  `PageHeader`, `EmptyState`, `Timeline`). Nadie redefine colores, badges ni
  formatos.
