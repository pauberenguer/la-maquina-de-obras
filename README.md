# La Máquina de Obras

Sistema de presupuestos y seguimiento para **Reformas Soler**, una empresa de
reformas de Barcelona. El jefe dicta la visita al salir del piso y sale un
presupuesto con su marca en minutos; cada presupuesto enviado avisa cuando el
cliente lo lee, se persigue solo, caduca con fecha, se firma en la propia página
y se mide en un panel con euros reales.

Tiene dos caras: la **web pública** de Reformas Soler (`/`), desde la que
cualquiera pide presupuesto (`/solicitar`), y el **panel de Manolo** (`/panel`),
protegido con una contraseña.

## Cómo se construyó

Con dos prompts a un agente de código. Cada paso tiene su tag:

| Tag | Qué hay |
|---|---|
| `chasis` | El punto de partida: Next.js, shadcn, la base de datos y las reglas del agente (`CLAUDE.md`). Ni una pantalla del producto |
| `v0` | Lo que sale de `PROMPT.md`: la web de Reformas Soler, `/solicitar`, `/entrar` y el panel con los datos de ejemplo |
| `fase-1` … `fase-7` | Lo que sale de `ARRANQUE.md`, fase a fase |
| `v1` | El producto entero, desplegado en producción |

Para verlo paso a paso: `git switch --detach chasis` (o cualquier otro tag) y
`git switch main` para volver.

Para reproducirlo desde cero: sal al tag `chasis`, abre tu agente en la carpeta
y dale el contenido de `PROMPT.md` (el de `main`). Cuando termine, el de
`ARRANQUE.md`.

## Arrancarlo en tu máquina

Hace falta **Node 20.9 o superior**.

```bash
npm install          # solo la primera vez
cp .env.example .env.local
```

Abre `.env.local` y pon al menos `OPENAI_API_KEY`, `PANEL_PASSWORD` y
`PANEL_SECRET` (este último, con `openssl rand -hex 32`). Lo demás es opcional:

| Variable | Para qué sirve | Si falta |
|---|---|---|
| `OPENAI_API_KEY` | La IA que lee la visita y redacta los seguimientos | Aviso en pantalla al convertir; el resto funciona |
| `OPENAI_MODEL` | Modelo | `gpt-5.6-terra` |
| `OPENAI_EFFORT` | Esfuerzo de razonamiento | `high` |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Avisos al móvil del jefe | Solo la campana del panel |
| `APP_URL` | Dominio con el que se generan los enlaces | `http://localhost:3000` |
| `PANEL_PASSWORD` | La contraseña del panel | El panel no abre y lo dice |
| `PANEL_SECRET` | Firma la cookie de sesión (32 caracteres o más) | El panel no abre y lo dice |
| `DATABASE_URL` + `DATABASE_AUTH_TOKEN` | La base que usa la app: en local, el fichero; en Vercel, Turso | `file:./data/demo.db` |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | La base de producción, solo para los scripts que la cargan | No se usa |
| `CRON_SECRET` | Protege `/api/tick` | El endpoint solo responde en desarrollo |
| `DEMO_MODE` | La barra del reloj de la demo | `1` |
| `DEMO_ALARMA` | Hora `HH:MM` a la que el seed deja un seguimiento listo para salir hoy | Dentro de 2 horas |
| `RESEND_API_KEY` + `RESEND_TO` | Seguimientos por email real | Solo quedan registrados |

Después:

```bash
npm run reset        # crea la base, importa el banco de precios y carga el seed
npm run dev          # http://localhost:3000
```

La web está en http://localhost:3000 y el panel en http://localhost:3000/panel,
que pide la contraseña de `PANEL_PASSWORD`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:3000 |
| `npm run check` | `tsc --noEmit`: no se enseña nada con errores de tipos |
| `npm run reset` | Vacía la base, aplica el esquema, importa el banco y carga el seed |
| `npm run db:push` | Aplica el esquema a la base sin migraciones |
| `npm run humo` | Prueba lo externo: la API de OpenAI, Telegram, `APP_URL` y Turso |
| `npm run build` | Compila para producción |

`npm run reset` **vacía la base entera** (borra sus tablas, no el fichero). Los datos de ejemplo se vuelven a
generar con fechas relativas al día en que lo ejecutas, así que lo que ves en
pantalla siempre parece de esta semana.

## Desplegar en producción (Vercel + Turso)

La app es la misma en local y en producción; solo cambia dónde está la base.

1. **Turso**: crea una base (región Irlanda, `aws-eu-west-1`) y un token de
   lectura y escritura sin caducidad. Pon los dos en `.env.local` como
   `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
2. **Los datos**: `npm run reset` en local (siembra con fechas de hoy) y después
   `npm run turso -- --confirmar`, que vacía Turso, le aplica el esquema y copia
   tu base local en lotes. Al final compara las filas de cada tabla.
3. **Vercel** (plan gratuito): importa el repositorio y pon estas variables:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | la URL de Turso (`libsql://…`) |
   | `DATABASE_AUTH_TOKEN` | el token de Turso |
   | `APP_URL` | `https://<tu-proyecto>.vercel.app` |
   | `PANEL_PASSWORD`, `PANEL_SECRET`, `CRON_SECRET` | los de tu `.env.local` |
   | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_EFFORT` | los de tu `.env.local` |
   | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | los de tu `.env.local` |
   | `DEMO_MODE` | `1` si quieres la barra del reloj en el panel |

   `vercel.json` ya fija las funciones en Dublín (`dub1`), junto a la base.
4. **Comprobarlo**: `APP_URL=https://<tu-proyecto>.vercel.app npm run humo`.

La ciudad de quien abre un presupuesto sale sola en producción: la pone Vercel
en sus cabeceras. En local se ve «ubicación desconocida».

## Cómo está montado

```
src/app/page.tsx     la web de Reformas Soler
src/app/solicitar/   pedir presupuesto
src/app/entrar/      la contraseña del panel
src/app/panel/       las páginas del panel, con la barra lateral
src/app/p/[token]/   la página pública del presupuesto, sin nada del panel
src/proxy.ts         protege /panel (en Next 16 el middleware se llama proxy)
src/app/api/         tracking, polling, tick
src/db/              esquema, conexión, banco de precios, seed y reset
src/lib/             reloj, importes, formatos, tipos, consultas, métricas, IA
src/components/      ui/ (shadcn) y los componentes propios
data/                base-precios.csv y demo.db (esta última fuera de git)
```

- **Next.js 16** (App Router, Turbopack), TypeScript estricto y Tailwind v4.
- **libSQL con Drizzle**, sin migraciones: el esquema se aplica con `db:push`.
  En local la base es un fichero; en producción, Turso. El acceso es asíncrono.
- **Una contraseña para el panel**, sin librerías: una cookie firmada con HMAC,
  un proxy en la puerta y la sesión comprobada otra vez en cada acción.
- **La IA solo entiende texto**: importes, estados, tiempos, caducidad, tracking
  y métricas son deterministas y no pasan por el modelo.
- **Nunca se inventa un precio**: solo existen los del banco (`data/base-precios.csv`)
  y los que escriba Manolo a mano. Lo demás sale en amarillo y sin precio.

## Los datos de ejemplo

El seed es determinista y cuadra al céntimo las cifras que salen en pantalla el
día en que se ejecuta: 12 presupuestos vivos por 87.400 €, de ellos 4 sin
respuesta desde hace más de 7 días por 31.200 €, y 28.900 € ganados en los
últimos 30 días. Si alguna no cuadrara, `npm run reset` aborta y lo dice.

La interfaz los declara como datos de ejemplo con una nota en Ajustes.
