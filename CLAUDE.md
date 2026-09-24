# La Máquina de Obras

Sistema de presupuestos y seguimiento para **Reformas Soler** (empresa de
reformas de 8 personas en Barcelona; el usuario es «Manolo · Reformas Soler»).
El jefe dicta la visita y sale un presupuesto con su marca en minutos; cada
presupuesto enviado avisa cuando el cliente lo lee, se persigue solo, caduca con
fecha, se firma en la propia página y se mide en un panel con euros reales.

## Stack

- Next.js 16 (App Router, `src/`, Turbopack) · TypeScript estricto · Tailwind v4.
- shadcn: los componentes ya están en `src/components/ui/`. Iconos de
  `lucide-react`. Fuente Geist local (`geist/font/sans`), sin fuentes remotas.
- libSQL con Drizzle (`drizzle-orm/libsql` + `@libsql/client`): en local, el
  fichero `data/demo.db`; en producción, Turso. Esquema en `src/db/schema.ts`.
  Sin migraciones: `npm run db:push` sincroniza el esquema con la base de
  `DATABASE_URL`. **El acceso a datos es asíncrono**: todo lo que lee o escribe
  la base devuelve una promesa y se espera.
- Despliegue en Vercel (plan gratuito, región `dub1`, junto a la base de Turso
  en Irlanda).
- IA: SDK oficial `openai`, Responses API. Modelo `gpt-5.6-terra`
  (`OPENAI_MODEL`), esfuerzo `high` (`OPENAI_EFFORT`), salida estructurada con
  `client.responses.parse` + `zodTextFormat` (de `openai/helpers/zod`). Solo
  en servidor.

## Comandos

- `npm run dev` — servidor de desarrollo en http://localhost:3000
- `npm run check` — `tsc --noEmit`; sin errores antes de enseñar nada
- `npm run reset` — borra la base, aplica el esquema, importa el banco de precios y carga el seed
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
  `Date.now()` solo dentro de ese fichero.
- Sin procesos en segundo plano ni `setInterval`: `tick()` (`src/lib/tick.ts`)
  ejecuta las tareas vencidas y expira lo caducado, y se llama desde el
  endpoint de polling y al mover el reloj de demo.
- El panel se refresca por polling cada 3 s. Sin SSE ni websockets.
- Un solo cliente de libSQL (singleton en `globalThis`). `ahora()` es la única
  lectura síncrona: el desplazamiento del reloj vive en memoria y se carga con
  `await cargarReloj()` al empezar cada petición.
- **Acceso**: una sola contraseña (`PANEL_PASSWORD`). `src/proxy.ts` protege
  `/panel/*` y `/api/pulso`; además, **cada Server Action del panel llama a
  `await exigirSesion()`**, porque una acción se puede invocar desde cualquier
  ruta. Públicos: `/`, `/solicitar`, `/p/[token]`, `/api/lectura` y
  `/api/publico/*`.
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
- Reiniciar el servidor de desarrollo sin avisar.
- Lorem ipsum, «próximamente», textos en inglés en la interfaz.

## Cómo trabajamos

- Por fases, según el plan aprobado. Al terminar una fase: qué hay, la URL
  para probarlo y qué falta. Después, parar y esperar.
- Antes de enseñar nada: `npm run check` sin errores y la ruta cargando sin
  errores en la consola del navegador ni del servidor.
- Commit al cerrar cada fase: `Fase N · título`.
- Subagentes solo con ficheros disjuntos. El esquema, la navegación, el layout
  y `src/lib/` los toca solo la sesión principal.
