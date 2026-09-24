# La Máquina de Obras — especificación del producto

Lee este documento ENTERO antes de hacer nada. Todo lo que necesitas está aquí:
no dependes de ningún fichero ni de ningún contexto previo (si hay un
`CLAUDE.md` en la carpeta, dice lo mismo que esto en corto y se respeta). Cuando termines de leerlo, propón un plan con las fases que se definen
al final y espera mi aprobación. No escribas ni una línea de código hasta que
apruebe el plan.

Lo que está en juego: este producto se enseña en directo, delante de cientos de
personas que van a juzgar en cada pantalla si esto es un producto real o un
juguete, y **acaba desplegado en producción, con dominio, para que cualquiera
de ellas pueda pedir un presupuesto desde su móvil**. Es la parte más crítica de todo el evento y llevamos semanas
preparándola: todo lo demás depende de que esto salga bien. No hay segunda
oportunidad ni tiempo para repetir nada. Te pido que lo hagas lo mejor que
sepas, que pienses bien cada decisión antes de ejecutarla, y que una vez
aprobado el plan lo hagas todo del tirón, sin detenerte, aprovechando cada
minuto. Si algo del documento es ambiguo, pregúntamelo en el plan, no
improvises.

## Cómo vamos a trabajar

- Tú eres el coordinador. Esta sesión es la principal: aquí propones el plan,
  aquí te doy correcciones y aquí revisamos el resultado de cada fase.
- **Trabajas sin parar.** Solo hay una aprobación: la del plan. Después no
  esperas a nadie: al cerrar cada fase me dejas un mensaje corto (qué hay, la
  URL exacta donde probarlo, qué falta) y sigues con lo siguiente. Yo pruebo
  cada fase en pantalla mientras tú avanzas. Solo te detienes si algo te
  bloquea de verdad y no puedes resolverlo tú.
- **El tiempo es lo que más importa: trabaja en paralelo.** No construyas las
  fases una detrás de otra si no dependen entre sí. El reparto está en «El
  reparto en paralelo», más abajo: tres carriles que avanzan a la vez y dos
  páginas sueltas. Tú eres el coordinador: fijas primero los contratos
  compartidos, levantas los subagentes, integras lo que devuelven, compruebas
  y commiteas fase a fase.
- **Todos los subagentes con Opus 5 y esfuerzo alto.** Lánzalos como forks
  (heredan esta especificación entera y el plan aprobado, y corren con tu
  mismo modelo); si un fork no es posible, agente general con `model: opus`.
  Nunca Sonnet ni Haiku: lo que construyen se enseña en pantalla grande.
  Escríbele a cada uno un prompt completo aunque herede contexto: qué carril
  es, qué ficheros son suyos, qué contratos usa, qué reglas de negocio le
  afectan, qué debe probar antes de devolver y el listón de acabado.
- **Ficheros disjuntos.** Nunca dos subagentes sobre el mismo fichero. El
  esquema, la navegación, el layout, `globals.css`, los componentes
  compartidos y `src/lib/` los editas solo tú. Cada subagente deja la app
  compilando en todo momento: nada de imports a ficheros que aún no existen
  en código que ya se carga.
- Verificas cada fase antes de anunciarla: `npm run check` sin errores y las
  rutas nuevas respondiendo en `http://localhost:3000` (con `curl`). Nunca
  anuncies algo que no has visto funcionar.
- Al final de cada fase, un commit: `Fase N · <título de la fase>`.
- Respondes en castellano y breve. Nada de resúmenes largos: qué hay, dónde se
  prueba, qué falta.

## El problema que resolvemos

Reformas Soler es una empresa de reformas de 8 personas en Barcelona. El dueño
se llama Manolo. Pierde dinero de dos formas:

1. **Presupuestar es lento.** Cada visita a un piso se convierte en 6-8 horas
   de despacho desglosando partidas, y el presupuesto se entrega 15-20 días
   después. Quien responde primero se lleva la obra: Manolo pierde obras de
   8.000-20.000 € por lento, no por caro.
2. **Nadie persigue lo enviado.** Los presupuestos salen como PDF por email o
   WhatsApp y mueren en silencio: no sabe si el cliente lo ha leído, nadie hace
   seguimiento porque todos están en obra, y el dinero se evapora.

## El producto

Un sistema donde Manolo dicta la visita al salir del piso y obtiene un
presupuesto profesional con su marca en minutos, y donde cada presupuesto
enviado avisa cuando el cliente lo lee, se persigue solo, caduca con fecha, se
firma en la propia página y se mide en un panel con euros reales (sumas de
presupuestos, nunca estimaciones).

El nombre del producto en la interfaz es **La Máquina de Obras**. La empresa es
**Reformas Soler**; el usuario es «Manolo · Reformas Soler».

## Punto de partida

Mira la carpeta antes de planificar. Hay tres situaciones posibles:

- **Carpeta vacía** (o solo con `.env.local`, `.env.example`, `.gitignore` o
  `.git`): la fase 0 es tuya entera, instalación incluida.
- **Chasis mínimo**: existe `package.json` con las dependencias ya instaladas,
  `CLAUDE.md`, `.claude/settings.json` y los componentes de shadcn en
  `src/components/ui/`, pero no hay producto. Respeta el `CLAUDE.md` (amplíalo
  solo si descubres algo que deba quedar escrito) y haz la fase 0 sin instalar
  nada.
- **Fase 0 hecha**: existe `FASE-0.md` en la raíz. No la repitas ni la
  reescribas. Lee `FASE-0.md` y `CLAUDE.md`, arranca el servidor, comprueba
  que la landing, Inicio, Presupuestos, Clientes y Ajustes cargan con datos, y
  propón el plan solo con las fases 1 a 7.

## Stack y reglas técnicas

- **Next.js 16** (App Router, carpeta `src/`), **TypeScript** estricto,
  **Tailwind v4**. Servidor y UI en un solo proceso.
- **libSQL** con **Drizzle** (`drizzle-orm/libsql` + `@libsql/client`). Es
  SQLite: mismo dialecto, mismo esquema. En desarrollo la base es un fichero
  (`file:./data/demo.db`); en producción es **Turso**, porque esto se despliega
  en **Vercel** y allí el disco es efímero. Sin migraciones: el esquema
  completo se crea en la fase 0 con `drizzle-kit push`; las fases 1-7 no
  cambian el esquema salvo necesidad justificada, y entonces me lo dices.
- **El acceso a datos es ASÍNCRONO.** El cliente de libSQL contra Turso solo
  tiene API de promesas, así que toda función de `src/lib/` que toque la base
  devuelve una promesa y se espera, y las páginas y componentes de servidor que
  leen datos son `async`. Hay **una excepción deliberada**: `ahora()` es
  síncrona (ver «Reloj de la aplicación»), porque la usa medio producto dentro
  de listas y de componentes de cliente.
- **Dependencias**, todas instaladas antes de la fase 1 y nunca después:
  `openai`, `drizzle-orm`, `@libsql/client`, `zod`, `lucide-react`,
  `geist`; en desarrollo `drizzle-kit`, `tsx`. Nada más: ni librerías de PDF,
  ni de firma, ni de fechas, ni de gráficos, ni de cron, ni de autenticación.
  Lo que haga falta se escribe a mano. A partir de la fase 1 están prohibidos
  `npm install` y `npx shadcn add`.
- **Componentes**: shadcn, con estos componentes ya instalados en
  `src/components/ui/`: button, badge, card, dialog, sheet, input, textarea,
  label, select, table, tabs, separator, switch, checkbox, tooltip,
  dropdown-menu, sonner, scroll-area, alert y skeleton. Si necesitas otro, lo
  escribes a mano en `src/components/`. Los avisos en pantalla van con
  `sonner`. Paleta propia de Reformas Soler en los tokens de `globals.css`
  (azul oscuro y naranja): que no parezca el shadcn de fábrica.
- **Tipografía** Geist local (`geist/font/sans`), sin fuentes remotas; iconos
  de `lucide-react`.
- **Dictado**: Web Speech API del navegador (`webkitSpeechRecognition`,
  `lang: "es-ES"`, modo continuo, con resultados intermedios apareciendo en
  pantalla mientras se habla; si el reconocimiento se corta por un silencio, se
  reanuda solo mientras el botón siga activo). El texto reconocido es editable
  antes de guardar, y en el mismo formulario hay siempre la alternativa
  idéntica: pegar las notas escritas. El dictado lo hace el navegador; a la
  API solo le llega texto.
- **IA**: la API de OpenAI con el SDK oficial `openai`, Responses API. Modelo
  `gpt-5.6-terra` por defecto, configurable con `OPENAI_MODEL`, y
  `reasoning: { effort }` con el valor de `OPENAI_EFFORT` (por defecto `high`).
  Salida estructurada siempre: `client.responses.parse` con
  `text: { format: zodTextFormat(schema, "nombre") }` (`zodTextFormat` se
  importa de `openai/helpers/zod`) y se lee `output_parsed`; nunca se parsea
  texto libre del modelo. Mientras la IA piensa, la interfaz lo dice con
  claridad («Leyendo la visita…», «Casando partidas contra el banco…»): nunca
  un spinner mudo. Toda llamada a la IA va en el servidor (route handlers o
  server actions), nunca desde el navegador.
- **PDF**: hoja de estilos de impresión (`@media print`) en la página del
  cliente y un botón «Descargar PDF» que lanza `window.print()`. Sin librerías.
- **Firma**: un canvas donde el cliente firma con el dedo o el ratón (pointer
  events); se guarda como PNG en base64 en la base de datos, con fecha, IP y
  dispositivo.
- **Tracking**: la propia página pública envía eventos a la propia app: una
  apertura al cargar; por sección con `IntersectionObserver`, enviando la
  duración al salir de la sección y al cerrar la pestaña con
  `navigator.sendBeacon`. En desarrollo la app vive en
  `http://localhost:3000` y el cliente abre el enlace desde otra ventana o
  desde un móvil en la misma wifi; ahí la ubicación se muestra como «ubicación
  desconocida». **En producción sí hay dominio**, y la ciudad sale de las
  cabeceras que pone Vercel (`x-vercel-ip-city`, `x-vercel-ip-country`,
  decodificando el porcentaje del nombre de ciudad); se leen también
  `cf-ipcity` y `cf-ipcountry` por si algún día hay Cloudflare delante. Nada de
  esto puede romper la página del cliente: si no llegan, se dice «ubicación
  desconocida» y ya. Dispositivo desde el user agent. Cada navegador recibe un
  identificador de visitante en una cookie para contar visitas.
- **Rutas**: el producto tiene dos mundos y se nota en la URL.
  **Público** (sin login, indexable salvo el presupuesto): `/` la landing de
  Reformas Soler, `/solicitar` el formulario para pedir presupuesto y
  `/p/[token]` el presupuesto de un cliente. **Privado**: todo el panel cuelga
  de `/panel` (`/panel`, `/panel/solicitudes`, `/panel/presupuestos/[id]`…).
  Los enlaces que salen por Telegram y por email apuntan a `APP_URL` con esa
  misma estructura.
- **Acceso**: el panel se protege con **una sola contraseña**, la de
  `PANEL_PASSWORD`, sin tabla de usuarios ni librería de autenticación. En
  Next 16 el middleware se llama **`src/proxy.ts`** (corre en Node.js): protege
  `/panel/*` y `/api/pulso`, y si no hay cookie de sesión válida redirige a
  `/entrar`, un formulario con un único campo. La cookie se firma con
  `PANEL_SECRET` (HMAC con `node:crypto`), es `httpOnly`, `sameSite=lax`,
  `secure` en producción, y dura 30 días. `/entrar` limita los intentos: cinco
  fallos seguidos desde una IP la bloquean quince minutos. **El proxy no basta**:
  una Server Action se puede invocar desde cualquier ruta, así que **cada acción
  del panel comprueba la sesión por sí misma** antes de tocar nada
  (`await exigirSesion()`). Quedan siempre abiertos `/`, `/solicitar`,
  `/p/[token]`, `/api/lectura` y `/api/publico/*` —los llama la página del
  cliente— y `/api/tick`, que se protege con su propio `CRON_SECRET`.
- **Panel en vivo**: la ficha del presupuesto, Inicio y Presupuestos se
  refrescan por polling cada 3 segundos contra un endpoint ligero. Sin SSE ni
  websockets.
- **Tareas programadas**: sin procesos en segundo plano ni `setInterval`.
  Existe una función `tick()` que ejecuta todas las tareas cuyo `ejecutar_en`
  sea anterior a la hora actual y marca como Expirado lo que haya pasado su
  fecha; la llama el endpoint de polling en cada petición y el botón del reloj
  de demo. En producción la dispara igual el panel abierto (el plan gratuito de
  Vercel no permite un cron por minuto); `/api/tick` existe por si algún día
  hay cron, y se protege con `CRON_SECRET`.
- **Reloj de la aplicación**: una sola función `ahora()` en `src/lib/` que
  devuelve la hora real más un desplazamiento guardado en la tabla `negocio`.
  TODO el código usa `ahora()`, nunca `new Date()` ni `Date.now()` directamente.
  La única excepción es `horaReal()` (`src/lib/hora-real.ts`): la caducidad de la
  sesión del panel y los límites por IP se miden con la hora real, para que
  adelantar el reloj de la demo no cierre la sesión ni levante un bloqueo.
  `ahora()` es **síncrona**: lee el desplazamiento de una variable en memoria
  del proceso, no de la base. Quien atiende una petición lo carga una vez con
  `await cargarReloj()` antes de pintar, y moverlo lo actualiza en el acto. Es
  la única concesión al mundo asíncrono, y existe para que
  `formatoRelativo(fecha, ahora())` siga funcionando dentro de un `.map()`.
  Con `DEMO_MODE=1` aparece una barra discreta con «⏩ +1 día», «⏩ +3 días» y
  «Reiniciar reloj» que cambia ese desplazamiento y llama a `tick()`.
- **Telegram**: mensajes con `fetch` a
  `https://api.telegram.org/bot<TOKEN>/sendMessage`. Sin librería.
- **Email de seguimiento** (opcional): si existe `RESEND_API_KEY`, el
  seguimiento se envía además por email con `fetch` a la API de Resend al buzón
  `RESEND_TO`; si no, solo queda registrado.
- **Zona horaria** `Europe/Madrid`; interfaz en castellano; importes en formato
  `es-ES` con euro (`14.300,50 €`); fechas `es-ES`.

## Variables de entorno

Lee `.env.local`. Si no existe, créalo copiando `.env.example` y avísame de qué
falta. Nunca imprimas su contenido ni lo pegues en la conversación. `.env.local`
está en `.gitignore` desde el primer commit; `.env.example` va sin valores.

| Variable | Obligatoria | Qué hace | Si falta |
|---|---|---|---|
| `OPENAI_API_KEY` | Sí | La IA dentro del producto | Aviso claro en la interfaz al convertir; nada más se rompe |
| `OPENAI_MODEL` | No | Modelo de la IA | `gpt-5.6-terra` |
| `OPENAI_EFFORT` | No | Esfuerzo de razonamiento de la IA (`low`, `medium`, `high`) | `high` |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | No | La notificación al móvil del jefe | Los avisos van solo a la campana del panel |
| `APP_URL` | No | Base con la que se generan los enlaces de los presupuestos y de los avisos | `http://localhost:3000` |
| `DATABASE_URL` + `DATABASE_AUTH_TOKEN` | No | La base que usa la app. En local, el fichero libSQL; en Vercel, la URL de Turso (`libsql://…`) con su token | `file:./data/demo.db` |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | En la fase 7 | La base de producción. **La app no las lee**: solo las usan los scripts que cargan el esquema y los datos en Turso, para que el local siga con su fichero | Nada: la app no las usa |
| `PANEL_PASSWORD` | Sí | La contraseña única del panel | El panel no arranca: lo dice con un error claro |
| `PANEL_SECRET` | Sí | Firma la cookie de sesión del panel | Igual que la anterior |
| `CRON_SECRET` | No | Protege `/api/tick` para que solo lo dispare el cron | El endpoint solo responde en desarrollo |
| `DEMO_MODE` | No | La barra del reloj de demo | `1` |
| `DEMO_ALARMA` | No | Hora real `HH:MM` de hoy a la que el seed deja programado un seguimiento pendiente | Ninguno |
| `RESEND_API_KEY` + `RESEND_TO` | No | Seguimientos por email real | Solo registro |

## La navegación

El panel vive entero bajo `/panel`. Barra lateral con el logo (wordmark
tipográfico «Reformas Soler», sin imagen; azul oscuro con acento naranja), el
botón primario **«+ Nueva Solicitud»** siempre visible, y 7 páginas en este
orden: **Inicio · Solicitudes · Presupuestos · Clientes · Precios · Plantillas
· Ajustes**. Solicitudes lleva un badge con las pendientes de convertir y
Presupuestos otro con los que llevan más de 7 días sin respuesta. Arriba a la
derecha, la campana de avisos con el contador de no leídos. Abajo, «Manolo ·
Reformas Soler», y ahí mismo «Salir», que borra la cookie de sesión.

Fuera del panel, sin barra lateral y sin un solo enlace de vuelta: la landing
en `/`, el formulario en `/solicitar` y la página del presupuesto en
`/p/[token]`.

**Mayúsculas de la interfaz**: los botones, los títulos de pantalla, los
titulines de sección, las etiquetas de campo, las cabeceras de tabla y los
nombres que vienen de la base (el título de la obra, el nombre de una
plantilla, el capítulo, la partida) se pintan en **Title Case castellano**:
palabras significativas en mayúscula y artículos, preposiciones y conjunciones
en minúscula salvo que abran («Enviar al Cliente», «Guardar como Plantilla»,
«Mi Empresa», «Reforma de Baño»). Las siglas no se tocan (IVA, CIF, PDF). Los
párrafos de ayuda, los placeholders y los mensajes de error son prosa normal.
Hay una única función `formatoTitulo()` en `src/lib/formato.ts` y la usa todo
el mundo: nadie capitaliza por su cuenta.

## Las pantallas

1. **Inicio** — dos alturas. **HOY**: lista accionable con quién ha abierto qué
   y cuándo, qué seguimientos salen hoy, qué presupuestos caducan en 3 días o
   menos y qué caducados se han vuelto a abrir. **LOS NÚMEROS**: € en
   presupuestos vivos · € sin respuesta más de 7 días · tasa de firma antes y
   después del sistema · tiempo medio de la visita al envío antes y después ·
   ganado en los últimos 30 días. Cada número con su fórmula visible en pequeño
   debajo (por ejemplo «suma del total de los presupuestos en Enviado, Visto y
   En conversación»).
2. **Solicitudes** — la bandeja de entrada. Cada visita dictada o pegada cae
   aquí con cliente, dirección, urgencia y la lista de conceptos crudos que la
   IA ha entendido; botones «Convertir en presupuesto» y «Descartar».
3. **Presupuestos** — kanban con columnas Borrador · Enviado · Visto · En
   conversación · Ganado · Perdido · Expirado, importe en cada tarjeta y total
   en € por columna; vista lista conmutable con buscador y filtro por estado.
   La ficha de cada presupuesto: cabecera con cliente, dirección, total, margen,
   estado y «válido hasta»; el enlace público con botón de copiar; acciones
   (abrir el editor si es Borrador; reenviar; marcar Perdido con motivo; marcar
   Ganado a mano); la **próxima acción programada** (qué seguimiento, cuándo y
   su texto editable); y el **timeline de Actividad** completo, en frases
   humanas: cada apertura (visita n.º, ciudad, dispositivo, tiempo por sección),
   cada seguimiento enviado con su texto, cada respuesta, cada cambio de estado
   con su porqué y cada aviso enviado.
4. **Clientes** — tabla con nombre, contacto, presupuestos, ganados y € total
   contratado; ficha por cliente con su historial.
5. **Precios** — el banco de precios por capítulos: buscador, edición en línea
   de precio y margen, alta y baja de partidas, activar y desactivar, importar
   CSV. Es la prueba de que el sistema no inventa precios.
6. **Plantillas** — presupuestos tipo («Baño completo», «Cocina completa»,
   «Pintura integral»): ver sus líneas, «Nuevo presupuesto desde plantilla», y
   «Guardar como plantilla» desde cualquier presupuesto.
7. **Ajustes** — Mi empresa: nombre, CIF, dirección, teléfono, email, color de
   marca, IVA en %, condiciones del presupuesto, texto base de cada uno de los
   tres seguimientos, caducidad por defecto en días. Persistido en la base y
   usado como única fuente de configuración: nada hardcodeado.

Fuera del menú:

8. **Flujo del presupuesto** (desde una solicitud o desde «+ Nueva visita»). El
   editor: tabla de líneas por capítulo con descripción, unidad, medición,
   precio unitario, margen y total por línea; todo editable en línea y
   recalculando en vivo; total y margen global siempre visibles; descuento
   global con **freno**: si el descuento deja el margen global por debajo del
   objetivo, aviso rojo con la cifra y confirmación explícita; líneas marcables
   como **opcionales**; las líneas **amarillas** (lo que no está en el banco)
   con el precio vacío hasta que Manolo lo ponga, las descarte o las añada al
   banco; añadir línea desde el banco con buscador; caducidad del presupuesto;
   botón «Enviar al cliente», que pasa a Enviado, genera el enlace, programa los
   seguimientos y redacta sus textos.
9. **Landing de Reformas Soler** (pública, `/`). La cara del negocio, no un
   folleto de software: la empresa, no la herramienta. Cabecera con el wordmark
   y un botón «Pedir Presupuesto»; un titular que promete lo que Manolo cumple
   («El presupuesto de tu reforma, en 24 horas»); tres o cuatro bloques con lo
   que hacen (baños, cocinas, pisos completos, pintura) sacados de los
   **capítulos reales del banco de precios**, cada uno con sus partidas de
   ejemplo, no inventados; una tira de confianza con cifras contadas en la base
   (clientes, obras contratadas, partidas con precio); cómo trabajan en tres
   pasos (visita → presupuesto en 24 h → obra);
   y el pie con teléfono, email, CIF y dirección de Ajustes. Primero móvil.
   Nada de lorem ipsum, nada de fotos de stock: tipografía, color y espacio.
   **Todo lo que enseñe sale de la base** (`negocio` y `partida`), para que al
   cambiar Ajustes cambie la landing.
10. **Pedir presupuesto** (pública, `/solicitar`). Un formulario corto y
   honesto: nombre, teléfono, email (opcional), dirección de la obra, qué obra
   es (baño, cocina, piso completo, pintura u otra: decide el título de la
   solicitud), para cuándo (sin prisa, en unos meses, cuanto antes: es la
   urgencia), «cuéntanos qué quieres hacer» (texto libre) y el permiso para
   usar esos datos solo para contactarle. Nada de precios, nada de plazos automáticos,
   ninguna promesa que el producto no pueda cumplir. Al enviar, cae en la
   bandeja de Solicitudes marcada **«del cliente · sin visita»** y se avisa a
   Manolo por campana y Telegram («🔔 Nueva solicitud desde la web · Marta Ruiz
   · Reforma de baño · Carrer de Verdi 71»). Las reglas de validación viven en
   un solo fichero (`src/lib/solicitud-web.ts`) que usan a la vez el navegador y
   el servidor. La pantalla de gracias dice la verdad: que Manolo
   llamará para concertar la visita, porque **sin ver la obra no hay
   presupuesto**. Defensas obligatorias, sin librerías: campo trampa oculto
   (honeypot), límite por IP (una solicitud por minuto, cinco por hora, en una
   tabla) y validación en el servidor.
11. **Página del cliente** (pública, `/p/[token]`, con un token no adivinable).
   El presupuesto como página web con la marca de Reformas Soler: cabecera con
   la empresa y el cliente; capítulos y líneas con mediciones y precios;
   opcionales que el cliente marca y recalculan el total en vivo; base, IVA y
   total; condiciones; «válido hasta el [fecha]» (pasada la fecha, la página lo
   dice y no deja aceptar); botón **«Aceptar presupuesto»** que abre la firma
   dibujada y, al confirmar, muestra el sello (fecha, hora, IP, dispositivo);
   botón **«Tengo dudas»** con un campo de texto; botón «Descargar PDF».
   **Primero móvil**: la mayoría la abrirá ahí. Sin nada del panel: ni menús ni
   enlaces internos.

## El ciclo del presupuesto (reglas de negocio)

- **Estados**: Borrador → Enviado → Visto → En conversación → Ganado / Perdido
  (con motivo) / Expirado. La primera apertura del cliente pasa de Enviado a
  Visto. «Tengo dudas» pasa a En conversación. La firma pasa a Ganado. Pasar la
  fecha de validez sin cierre pasa a Expirado. Ganado, Perdido y Expirado
  cancelan las tareas pendientes.
- **Importes**: en cada línea `total = precio × medición`; el coste implícito de
  una línea es `precio × (1 − margen)`; el margen global es
  `(base − coste) / base`. La base es la suma de las líneas no opcionales más
  las opcionales que el cliente haya marcado; el IVA es el de Ajustes; el
  **importe** de un presupuesto en tarjetas, columnas y métricas es el total
  con IVA. Todo el cálculo es determinista y vive en una sola función
  compartida por el editor, la página pública y el seed.
- **Precios**: el sistema no inventa precios jamás. Solo existen los del banco
  o los que Manolo escriba a mano. Una línea sin partida del banco es amarilla
  y no tiene precio hasta que él lo ponga.
- **Sin visita no hay presupuesto.** Una solicitud puede nacer de dos sitios y
  no valen lo mismo: la que **dicta Manolo** al salir del piso trae mediciones
  y se convierte en presupuesto con precios del banco; la que llega **de la
  web** trae lo que el cliente supo contar y ninguna medición. La segunda entra
  con `origen = "cliente"`, se distingue en la bandeja con su badge, y al
  convertirla el producto avisa de lo que es: sale un borrador con todas las
  líneas amarillas y sin precio, porque nadie ha visto la obra. La regla de los
  precios no se relaja por venir de internet.
- **Tracking**: cada apertura crea un evento de lectura con visitante, visita
  n.º, ciudad, dispositivo y tiempo por sección, alimenta el timeline y
  actualiza HOY. Cada apertura avisa por Telegram y por la campana con el
  importe («👀 María Gómez acaba de abrir tu presupuesto de 14.300 € · Baño ·
  Calle Mallorca 42 · 2.ª visita · móvil · Barcelona») y un enlace a la ficha.
  **Agrupado**: por presupuesto, como máximo un aviso por minuto; si en ese
  minuto llegan más aperturas, el siguiente aviso lleva el recuento y las
  ciudades («👀 37 aperturas nuevas del presupuesto de 14.300 € en el último
  minuto · 12 ciudades»). Una apertura de un presupuesto Expirado también
  avisa, marcada como señal de compra («🔁 se ha vuelto a abrir un presupuesto
  caducado»).
- **Persecución**: al enviar se programan tres seguimientos a los 3, 7 y 14 días
  (contados con el reloj de la aplicación) y la IA redacta los tres textos en
  ese momento, a partir del presupuesto y de los textos base de Ajustes; quedan
  guardados y editables en la ficha. Cuando `tick()` ejecuta uno: se registra en
  el timeline con el texto, avisa por Telegram y campana («📨 seguimiento 2
  enviado a María · 14.300 €») y, si hay Resend, sale por email. Se detienen
  (se cancelan las pendientes) si el cliente responde, acepta o el presupuesto
  se cierra. Máximo tres toques, por construcción. El último menciona la
  caducidad con los días reales que quedan («tu presupuesto expira en 3 días»).
  La respuesta del cliente pausa todo y avisa («💬 María tiene dudas · los
  seguimientos se han pausado · llámala»).
- **Caducidad**: por defecto la de Ajustes (15 días desde el envío), editable
  por presupuesto antes de enviar.
- **Firma**: al firmar se guardan la imagen, la fecha y hora, la IP y el
  dispositivo; el presupuesto pasa a Ganado; aviso («✅ María ha aceptado y
  firmado el presupuesto de 14.300 € · obra ganada»); la página pública muestra
  el sello y deja de ser editable.

## La IA dentro del producto (dos trabajos, nada más)

**Trabajo 1 · Entender la visita y casarla con el banco**, en dos pasos:

- *Entender* (fase 1): del texto dictado o pegado extrae, con esquema estricto,
  el nombre del cliente si se dice, teléfono o email si se dicen, la dirección
  de la obra, la urgencia (baja, media o alta) y la lista de conceptos, cada uno
  con descripción corta, medición y unidad si se han dicho, y notas. No valora
  ni pone precios.
- *Casar* (fase 2): recibe los conceptos y el banco de precios activo completo
  (código, capítulo, nombre, unidad) y devuelve, para cada concepto, el código
  de la partida que mejor encaja o `null` si ninguna encaja de verdad, la
  medición propuesta en la unidad de la partida, una confianza de 0 a 1 y un
  motivo de una frase. El servidor pone el precio y el margen desde el banco;
  una confianza inferior a 0,6 o un código `null` se pintan en amarillo. Si una
  descripción encaja con varias partidas, elige la más específica; si duda
  entre dos gamas, elige la gama media. Nunca inventa códigos: el servidor
  valida contra el banco y, si el código no existe, la línea es amarilla.

**Trabajo 2 · Redactar los tres seguimientos** (fase 6, en el momento de
enviar): tono cercano y profesional, en castellano, firmados por Manolo, cortos
(60-90 palabras), cada uno con un ángulo distinto (recordatorio amable · «¿os
encajó el precio o lo ajustamos por fases?» · aviso de caducidad con los días
que quedan), a partir del presupuesto (cliente, obra, total, líneas
principales) y de los textos base de Ajustes.

Todo lo demás (el cálculo, los estados, los tiempos, el tracking, las métricas)
es determinista y no pasa por la IA.

## El banco de precios de Reformas Soler

En la fase 0 escribes este fichero tal cual en `data/base-precios.csv` y lo
cargas en la tabla de partidas (el seed lo importa; Precios permite
reimportarlo). Precios en euros sin IVA, mano de obra y material incluidos
salvo que se diga lo contrario; unidades `ud`, `m²`, `ml`, `m³`, `h` y `pa`
(partida alzada); `margen_objetivo` en %. No añadas partidas por tu cuenta: el
banco es el de Manolo.

```csv
codigo,capitulo,partida,unidad,precio,margen_objetivo
DEM-01,Demoliciones,Demolición de bañera y retirada de escombros a contenedor,ud,380,35
DEM-02,Demoliciones,Demolición de plato de ducha existente,ud,240,35
DEM-03,Demoliciones,Picado de alicatado en paramentos,m²,14,40
DEM-04,Demoliciones,Picado de solado y capa de mortero,m²,18,40
DEM-05,Demoliciones,Desmontaje de sanitarios y mobiliario de baño (conjunto),ud,180,40
DEM-06,Demoliciones,Demolición de tabique de ladrillo hasta 10 cm,m²,32,35
DEM-07,Demoliciones,Desmontaje de mobiliario de cocina,ud,260,40
DEM-08,Demoliciones,Contenedor de escombros 5 m³ (alquiler + transporte + tasas),ud,290,15
DEM-09,Demoliciones,Bajada de escombros por medios manuales sin ascensor,m³,45,30
DEM-10,Demoliciones,Levantado de puerta y marco,ud,55,40
ALB-01,Albañilería,Tabique de ladrillo hueco doble,m²,48,30
ALB-02,Albañilería,Enfoscado de paramento con mortero de cemento,m²,22,35
ALB-03,Albañilería,Recrecido de suelo con mortero autonivelante,m²,26,30
ALB-04,Albañilería,Enlucido de yeso a buena vista,m²,16,35
ALB-05,Albañilería,Formación de pendientes para plato de ducha de obra,ud,320,30
ALB-06,Albañilería,Impermeabilización de zona de ducha (lámina + cinta),m²,38,30
ALB-07,Albañilería,Cierre de rozas y remates,pa,180,40
ALB-08,Albañilería,Trasdosado de placa de yeso laminado,m²,42,30
ALB-09,Albañilería,Falso techo de placa de yeso laminado,m²,44,30
ALB-10,Albañilería,Apertura de hueco en tabique para puerta,ud,240,30
FON-01,Fontanería,Renovación de instalación de fontanería de baño completo (PEX agua fría y caliente),ud,890,30
FON-02,Fontanería,Punto de agua nuevo (toma fría y caliente + desagüe),ud,160,35
FON-03,Fontanería,Plato de ducha de resina 120×80 instalado,ud,690,28
FON-04,Fontanería,Plato de ducha de resina 140×80 instalado,ud,760,28
FON-05,Fontanería,Mampara de ducha frontal corredera instalada,ud,520,25
FON-06,Fontanería,Grifería termostática de ducha instalada,ud,290,25
FON-07,Fontanería,Grifería monomando de lavabo instalada,ud,145,25
FON-08,Fontanería,Inodoro compacto instalado,ud,320,25
FON-09,Fontanería,Mueble de baño suspendido 80 cm con lavabo instalado,ud,640,25
FON-10,Fontanería,Espejo de baño con luz LED instalado,ud,210,25
FON-11,Fontanería,Renovación de desagües de baño,ud,380,30
FON-12,Fontanería,Termo eléctrico 80 l instalado,ud,420,25
FON-13,Fontanería,Renovación de instalación de fontanería de cocina,ud,520,30
ELE-01,Electricidad,Punto de luz sencillo con mecanismo,ud,65,35
ELE-02,Electricidad,Punto de luz conmutado con mecanismos,ud,85,35
ELE-03,Electricidad,Toma de corriente 16 A,ud,58,35
ELE-04,Electricidad,Renovación de instalación eléctrica de baño,ud,380,30
ELE-05,Electricidad,Renovación de instalación eléctrica de cocina,ud,620,30
ELE-06,Electricidad,Cuadro eléctrico nuevo con protecciones,ud,540,25
ELE-07,Electricidad,Downlight LED empotrado instalado,ud,48,30
ELE-08,Electricidad,Extractor de baño con temporizador instalado,ud,140,30
ALI-01,Alicatados y solados,Alicatado con azulejo cerámico gama media (material incluido),m²,84,30
ALI-02,Alicatados y solados,Alicatado con porcelánico gran formato gama alta (material incluido),m²,118,30
ALI-03,Alicatados y solados,Solado con gres porcelánico gama media (material incluido),m²,78,30
ALI-04,Alicatados y solados,Solado con gres porcelánico gama alta (material incluido),m²,105,30
ALI-05,Alicatados y solados,Rodapié cerámico,ml,14,35
ALI-06,Alicatados y solados,Suelo laminado AC5 instalado (material incluido),m²,38,30
ALI-07,Alicatados y solados,Suelo vinílico en lamas instalado (material incluido),m²,46,30
ALI-08,Alicatados y solados,Rejuntado con junta epoxi,m²,12,40
CAR-01,Carpintería,Puerta de paso lacada blanca con marco y herrajes,ud,380,25
CAR-02,Carpintería,Puerta corredera con casete empotrado,ud,760,25
CAR-03,Carpintería,Armario empotrado a medida (frente + interior),ml,640,25
CAR-04,Carpintería,Ventana de PVC oscilobatiente con doble vidrio,ud,620,22
CAR-05,Carpintería,Rodapié de DM lacado,ml,11,35
PIN-01,Pintura,Pintura plástica lisa en paredes y techos (dos manos),m²,9,40
PIN-02,Pintura,Alisado de gotelé y pintado,m²,18,40
PIN-03,Pintura,Esmaltado de puerta y marco,ud,95,40
PIN-04,Pintura,Pintado de radiador,ud,45,40
COC-01,Cocina,Mobiliario de cocina en laminado (suministro y montaje),ml,520,25
COC-02,Cocina,Encimera de cuarzo compacto,ml,290,25
COC-03,Cocina,Encimera de laminado postformado,ml,95,25
COC-04,Cocina,Fregadero bajo encimera con grifería instalado,ud,380,25
COC-05,Cocina,Instalación de electrodoméstico (por unidad),ud,60,40
COC-06,Cocina,Campana extractora decorativa instalada,ud,340,25
CLI-01,Climatización,Split de aire acondicionado 3.000 frigorías instalado,ud,980,22
CLI-02,Climatización,Radiador toallero eléctrico instalado,ud,260,25
GES-01,Gestión y varios,Protección de zonas comunes y mobiliario,pa,140,40
GES-02,Gestión y varios,Limpieza final de obra,pa,220,40
GES-03,Gestión y varios,Gestión de licencia de obra menor (sin tasas),pa,180,45
GES-04,Gestión y varios,Transporte y medios auxiliares,pa,160,30
GES-05,Gestión y varios,Hora de oficial de primera,h,34,35
GES-06,Gestión y varios,Hora de peón,h,26,35
```

## El seed (datos de ejemplo)

Un script determinista (`npm run reset`: borra la base, aplica el esquema,
importa el banco y carga el seed). Sin aleatoriedad: datos literales escritos
en el script, con fechas RELATIVAS al día en que se ejecuta para que siempre
parezcan de esta semana. Declarado en la interfaz como datos de ejemplo con una
nota discreta en Ajustes, nada más. Contenido:

- `negocio`: Reformas Soler · CIF B66412907 · Carrer de Provença 233, 08008
  Barcelona · 93 555 41 20 · hola@reformassoler.es · IVA 21 · caducidad 15
  días · condiciones de un presupuesto real de reformas (forma de pago
  40/40/20, plazo orientativo, no incluye licencias ni tasas, validez) · tres
  textos base de seguimiento · `fecha_alta` hace 45 días (el día en que Manolo
  empezó a usar el sistema; lo anterior es historial importado) ·
  desplazamiento del reloj 0.
- 18 clientes con nombres y apellidos españoles y catalanes variados, teléfonos
  `6xx xxx xxx` ficticios y emails en `@example.com`.
- Unos 37 presupuestos de obras de vivienda en Barcelona y alrededores (baños,
  cocinas, pintura, reformas integrales, suelos, ventanas), cada uno con 5-14
  líneas reales del banco, mediciones creíbles y direcciones plausibles.
  **Estas cifras se cuadran exactamente, con el reloj sin desplazar, el día en
  que se ejecuta el seed** (salen en las diapositivas):
  - Vivos (Enviado + Visto + En conversación): **12 presupuestos, 87.400 € en
    total** (totales con IVA).
  - De esos, sin respuesta más de 7 días (ninguna apertura ni respuesta del
    cliente en los últimos 7 días; enviados hace 8 días o más): **4
    presupuestos, 31.200 €**, con sus seguimientos 1 y 2 ya ejecutados en el
    timeline y el cierre pendiente.
  - Ganados en los últimos 30 días: **3 presupuestos, 28.900 €** (ganados en
    total: 5).
  - Tasa de firma: cerrados antes de `fecha_alta`, **1 ganado de 6** (17 %);
    cerrados después, **4 ganados de 17** (24 %). Cerrado = Ganado + Perdido +
    Expirado.
  - Tiempo medio de la visita al envío: antes de `fecha_alta`, **14 días**;
    después, **1 día**.
  - Perdidos (14) con motivo variado: precio, otro presupuesto, aplazan la
    obra, sin respuesta. Expirados: 4, y **uno de ellos con una apertura de
    hace 2 días** (la señal de compra que sale en HOY).
  - 2 borradores.
  - HOY, al ejecutar el seed, tiene material: 2 aperturas de hoy (una desde el
    móvil en Barcelona y otra desde el ordenador en Sabadell), 1 seguimiento
    que sale hoy (a la hora real de `DEMO_ALARMA` si existe; si no, dentro de 2
    horas) y 2 presupuestos que caducan en 3 días o menos.
- Eventos de lectura coherentes con los estados: los Vistos y En conversación
  tienen aperturas con visita n.º, ciudad, dispositivo y tiempo por sección;
  los En conversación tienen su respuesta; los Ganados tienen firma con sello.
- 3 solicitudes pendientes de convertir: dos dictadas por Manolo (una pintura
  de piso de 90 m² y una cocina) con sus conceptos, y **una llegada de la web**
  (`origen = "cliente"`), sin conceptos y con el texto tal y como lo escribió
  el cliente, para que se vea la diferencia en la bandeja desde el primer día.
- 3 plantillas: «Baño completo», «Cocina completa» y «Pintura integral», con
  líneas del banco.

## El acabado

Que parezca un producto vertical serio en producción, no una plantilla:
interfaz entera en castellano, sin anglicismos de interfaz; importes y fechas
`es-ES`; estados con el mismo color en todo el producto (Borrador gris ·
Enviado azul · Visto violeta · En conversación ámbar · Ganado verde · Perdido
rojo · Expirado gris oscuro); el badge del menú con el número real; páginas
vacías con un mensaje útil (nunca lorem ipsum ni «próximamente»); densidad
real gracias al seed; diseño limpio y sobrio, con jerarquía clara y espacio
generoso: un SaaS de oficio, no un juguete de demo; la página del cliente
impecable en un móvil de 375 px, correcta en escritorio y correcta impresa.
Sin errores ni avisos en la consola del navegador ni en la del servidor. Este
listón no es negociable: exígeselo también a cada subagente.

## El estilo (la referencia que todos siguen)

Con varios subagentes a la vez, el estilo no se improvisa: nace en la fase 0
en `globals.css` y en los componentes compartidos, y nadie redefine un color,
un badge ni un formato por su cuenta.

- **La referencia visual del panel es Holded.** En `referencias/holded/` hay
  cinco capturas: míralas tú antes de diseñar nada y dile a cada subagente que
  las mire (si la carpeta no existiera, sigue esta descripción). Qué se toma
  de cada una:
  - `01-inicio-kpis-y-acciones-pendientes`: el Inicio. Saludo, una tarjeta con
    tres números grandes (etiqueta gris arriba, cifra a 30 px, chip de
    variación al lado) y una lista de «acciones pendientes» con icono, frase y
    enlace a la sección con chevrón. Nuestro HOY es exactamente esa lista, y
    LOS NÚMEROS esa tarjeta.
  - `02-documento-con-panel-lateral`: la ficha del presupuesto. El documento a
    la izquierda (logo, empresa, título, número y fechas, bloque de cliente,
    total grande, tabla de líneas con filas en gris claro, subtotal, IVA y
    total) y a la derecha un panel con pestañas (aquí: General · Actividad ·
    Seguimientos), pares clave-valor, el chip de estado y el botón primario
    «Enviar». La página pública del cliente es ese documento a pantalla
    completa, sin el panel.
  - `03-listado-con-filtros-y-panel`: listados con filtros en desplegables,
    casillas, cifras alineadas a la derecha, positivos en verde, y un panel
    lateral con búsqueda y totales al pie con botones secundario y primario.
    Así van Solicitudes, la vista lista de Presupuestos y Precios.
  - `04-tabla-con-badges-de-estado`: los badges de estado con fondo suave y
    punto de color, el icono junto al nombre, las acciones arriba a la derecha
    (secundaria con borde, primaria azul con pista de teclado). Así son
    nuestros `EstadoBadge` y las cabeceras de página.
  - `05-panel-de-control-con-tarjetas`: tarjetas de KPI (etiqueta pequeña,
    cifra grande) agrupadas en una tarjeta mayor con enlace «Ir a…», y listas
    de filas con etiqueta, dato en gris, importe y chevrón. Vale para Clientes
    y para los totales por columna del kanban.
  Lo que Holded no tiene y se toma de otros: el kanban con el total en € por
  columna, como Jobber o Fergus; y la página del cliente en móvil, con el
  botón de aceptar siempre a mano, como PandaDoc o Qwilr.
- **Paleta** (en los tokens de shadcn de `globals.css`; conviértela a `oklch`),
  calcada de las capturas: fondo de página `#F6F7F9`, superficies blancas con
  borde `#E5E7EB` y radio 12 px, texto `#1B1F24`, secundario `#6B7280`.
  Primario azul `#2E6BE6` (hover `#2559C4`), texto blanco encima: es el color
  de «+ Nueva visita», «Enviar al cliente» y toda acción primaria. Naranja
  `#F28C28` solo para el badge «sin respuesta» y los avisos que piden acción.
  Badges de estado con fondo suave y punto de color, siempre iguales en todo
  el producto: Borrador gris (`#6B7280` sobre `#F3F4F6`) · Enviado azul
  (`#2563EB` sobre `#EAF1FE`) · Visto violeta (`#7C3AED` sobre `#F1EAFE`) ·
  En conversación ámbar (`#D97706` sobre `#FEF3E2`) · Ganado verde (`#16A34A`
  sobre `#E6F7EE`) · Perdido rojo (`#DC2626` sobre `#FDECEC`) · Expirado gris
  oscuro (`#374151` sobre `#E5E7EB`). Positivos en verde `#16A34A` en las
  tablas. Línea amarilla (fuera del banco): fondo `#FEF3C7`, borde `#F59E0B`.
- **Tipografía.** Geist. Títulos de página 22 px semibold; cuerpo 14 px;
  cifras con `tabular-nums` en tablas e importes; los números grandes de
  Inicio a 30 px semibold con su fórmula a 12 px en gris debajo.
- **Forma y densidad.** Radio 8 px; bordes de 1 px, sin sombras salvo en
  diálogos; filas de tabla de 40 px; cabecera de página con título, subtítulo
  en gris y acciones a la derecha.
- **Barra lateral.** Como la de Holded: 240 px, fondo azul marino `#1B2537`,
  texto claro, icono y etiqueta en cada ítem, ítem activo con fondo blanco al
  10 % y esquinas redondeadas, badge naranja en Presupuestos. Arriba, el
  wordmark «Reformas Soler» y la campana; debajo, «+ Nueva Solicitud» a todo el
  ancho en azul primario. Abajo, «Manolo · Reformas Soler» con avatar y
  chevrón.
- **Componentes compartidos**, en `src/components/`, creados en la fase 0 y
  reutilizados por todos: `Sidebar`, `PageHeader`, `EstadoBadge`, `Importe`
  (formato es-ES, tabular), `Kpi` (número + fórmula), `EmptyState`, `Timeline`
  (entradas en frases humanas con icono y hora), `Campana`, `BarraReloj`.
- **La página del cliente.** Cabecera con el wordmark, la dirección de la
  obra, el número y la fecha; capítulos como secciones con subtotal; opcionales
  con casilla y recálculo; bloque de total destacado (base, IVA, total);
  condiciones; «válido hasta»; en móvil, barra inferior fija con «Aceptar
  Presupuesto» y «Tengo Dudas»; impresa, sin barra ni botones.

- **La landing.** El mismo lenguaje visual que el resto, pero respirando más:
  ancho máximo generoso, tipografía grande en el titular, el azul marino y el
  naranja de la casa, y cero adornos. Tiene que parecer la web de una empresa
  de reformas que va en serio, no la web de un software.
- **Textos.** Castellano de oficio, en Title Case (ver «La navegación»).
  Verbos en los botones («Convertir en Presupuesto», «Enviar al Cliente»,
  «Guardar como Plantilla»). Nunca «Submit», «Dashboard», «OK» ni «Loading».

## Modelo de datos (mínimo; añade lo que necesites)

`negocio` (singleton: datos de empresa, color, iva, condiciones, textos base
×3, caducidad_dias, fecha_alta, reloj_offset_ms) · `partida` (codigo, capitulo,
nombre, unidad, precio, margen_objetivo, activa) · `cliente` (nombre, telefono,
email, notas) · `solicitud` (cliente_nombre, telefono, email, direccion, titulo,
urgencia, texto_original, conceptos JSON, `origen` manolo/cliente, estado
pendiente/convertida/descartada, presupuesto_id, creado_en) · `peticion_web`
(ip, motivo solicitar/entrar, ts: el límite por IP del formulario público y de
la contraseña, medido con la hora real y no con el reloj de la demo) · `presupuesto` (numero, token, cliente_id, direccion_obra,
titulo, estado, iva, descuento_pct, base, iva_importe, total, coste,
margen_pct, caducidad_dias, valido_hasta, visita_en, creado_en, enviado_en,
cerrado_en, motivo_perdido, respondio_en, firma_png, firmado_en, firma_ip,
firma_dispositivo, ultimo_aviso_en, solicitud_id, plantilla_id) · `linea`
(presupuesto_id, partida_id opcional, capitulo, descripcion, unidad, medicion,
precio, precio_manual, margen_pct, total, confianza, amarilla, opcional,
elegida, orden, motivo_ia) · `evento_lectura` (presupuesto_id, visitante_id,
visita_n, seccion, duracion_s, ip, ciudad, pais, dispositivo, ts) ·
`tarea_programada` (presupuesto_id, tipo seguimiento_1/seguimiento_2/cierre,
ejecutar_en, estado pendiente/enviada/cancelada, asunto, texto, ejecutada_en) ·
`evento` (presupuesto_id, tipo, meta JSON, ts: alimenta el timeline, HOY y las
métricas) · `plantilla` (nombre, descripcion, lineas JSON) · `aviso`
(presupuesto_id, texto, leido, ts: la campana).

## Las fases

Planifica exactamente estas fases, en este orden. Cada una termina en algo que
se prueba en pantalla.

**Fase 0 · El chasis** (si existe `FASE-0.md`, sáltala)

- Si la carpeta está vacía: proyecto Next.js 16 con TypeScript, App Router,
  `src/` y Tailwind v4; dependencias y componentes de shadcn instalados;
  `.gitignore` con `.env.local`, `data/*.db` y `node_modules`; `git init` y
  primer commit. Si ya hay chasis mínimo, nada de esto: está hecho.
- Esquema completo en Drizzle (todas las tablas) y `drizzle-kit push`;
  `src/lib/` con `ahora()`, el cálculo de importes, los formatos `es-ES` y el
  cliente de base de datos.
- `data/base-precios.csv` tal cual y el seed completo; `npm run reset`.
- Los tokens de estilo en `globals.css` y los componentes compartidos de «El
  estilo». Layout del panel bajo `/panel`, con la barra lateral, las 7
  entradas, el botón «+ Nueva Solicitud» (en esta fase abre una página vacía
  con mensaje útil), la campana y la barra del reloj de demo (solo mueve el
  reloj; `tick()` llega en la fase 6).
- **La puerta de la calle, desde el primer día**, porque decide las rutas de
  todo lo demás: la **landing** en `/` terminada y con los datos de la base
  (pantalla 9); `/solicitar` con el formulario montado y validado en el
  navegador, que en esta fase todavía **no guarda** —enseña un aviso honesto de
  que llega en la fase 1—; y `/entrar` con el campo de contraseña y el
  `proxy.ts` protegiendo `/panel/*` de verdad. Al terminar la fase 0,
  entrar en `/panel` sin contraseña tiene que ser imposible.
- Los **contratos** en `src/lib/tipos.ts`: los tipos de dominio y las firmas
  de las funciones que unen los carriles (`extraerVisita`, `casarConceptos`,
  `calcularImportes`, `enviarPresupuesto`, `registrarLectura`, `notificar`,
  `tick`), aunque el cuerpo llegue después. Es lo que permite que tres
  subagentes trabajen a la vez sin inventarse la interfaz.
- Las páginas de ver, terminadas y con los datos del seed: **Inicio**,
  **Presupuestos** (kanban, lista, badge y ficha con timeline y próxima acción;
  sin editor todavía), **Clientes** y **Ajustes** (formulario funcional).
  Solicitudes, Precios y Plantillas existen en el menú y muestran una página
  vacía con mensaje útil.
- `CLAUDE.md` corto (menos de 100 líneas: stack, comandos, estructura, las
  reglas de negocio innegociables, convenciones, prohibido) si no existe;
  si existe, se respeta. `README.md` para quien arranque el repo en su máquina
  (instalar, crear claves, `npm run reset`, `npm run dev`). Scripts en
  `package.json`: `check` (`tsc --noEmit`), `db:push`, `reset` y `humo`
  (prueba la API de OpenAI, Telegram y `APP_URL`, sin imprimir claves).
- `FASE-0.md` con el inventario de lo hecho y cómo verificarlo. Commit y tag
  `v0`.

**Fase 1 · Las dos entradas** — la bandeja de Solicitudes se llena por dos
sitios. **La de Manolo**: «+ Nueva Solicitud» con dictado por Web Speech (el
texto apareciendo en vivo) o notas pegadas, cliente y dirección editables; al
guardar, la IA extrae los conceptos y la solicitud cae en la bandeja. **La de
la calle**: el formulario de `/solicitar` empieza a guardar de verdad, con su
honeypot y su límite por IP, crea la solicitud con `origen = "cliente"` y avisa
por campana y Telegram. En la bandeja se distinguen de un vistazo. «Convertir
en Presupuesto» crea un Borrador con las líneas crudas (sin precio todavía) y
abre su ficha; si la solicitud venía de la web, el aviso dice que sale sin
precios porque nadie ha visto la obra. Se prueba: dicto la visita de un baño y
aparece con sus conceptos; relleno `/solicitar` desde el móvil y aparece
marcada «del cliente», con el aviso sonando.

**Fase 2 · Partidas contra el banco y la página Precios** — «Convertir» casa
cada concepto con el banco: partida, unidad, medición, precio, margen y
confianza; lo que no está, en amarillo y sin precio. Página Precios completa.
Se prueba: las líneas con precio y margen, una amarilla, y en Precios se ve que
esa partida no existe.

**Fase 3 · El editor** — la tabla editable con recálculo en vivo, opcionales,
resolver amarillos (precio, descartar o añadir al banco), añadir desde el
banco, descuento con freno de margen, caducidad del presupuesto. Se prueba:
ajusto una medición, resuelvo la amarilla y el freno salta con un descuento.

**Fase 4 · La página del cliente y las plantillas** — «Enviar al cliente»
(Enviado, enlace, programa los seguimientos y redacta sus textos); la página
pública completa (opcionales con recálculo, condiciones, caducidad, firma con
sello, «Tengo dudas», PDF); «Guardar como plantilla», «Nuevo desde plantilla»
y la página Plantillas. Se prueba: abro el enlace en un móvil, marco un
opcional, descargo el PDF, guardo como plantilla.

**Fase 5 · Tracking** — los eventos de lectura desde la página pública, el
timeline de Actividad en frases humanas, HOY en Inicio con datos reales, el
polling de 3 segundos, la campana y los avisos de Telegram agrupados, la señal
de compra en expirados. Se prueba: alguien abre el enlace desde un móvil, el
timeline se llena, el panel salta y el móvil del jefe recibe el aviso; si
llegan muchas aperturas en un minuto, un solo aviso con el recuento.

**Fase 6 · Persecución, reloj y firma** — `tick()`, la ejecución de los
seguimientos con aviso y email opcional, la parada al responder, el Expirado
automático, el reloj de demo completo. La firma, construida en la fase 4, mueve
la tarjeta a Ganado y recalcula Inicio: compruébalo de punta a punta. Se
prueba: «⏩ +3 días» y el seguimiento sale solo; el cliente firma en el móvil,
la tarjeta salta a Ganado e Inicio suma. Commit: «Fase 6 · Persecución, reloj y
firma».

**Fase 7 · A producción** — el producto sale a internet. Todo lo demás se ha
demostrado en local; aquí se demuestran dos cosas: que **la parte del cliente
funciona desde cualquier móvil** y que **el panel solo se abre con la
contraseña**. Base en **Turso** con el esquema aplicado y los datos de la demo
cargados desde el fichero local (un script que usa `TURSO_DATABASE_URL` y
`TURSO_AUTH_TOKEN` y lo sube en lotes, no fila a fila); despliegue en **Vercel**,
plan gratuito, región `dub1` (Dublín, junto a la base de Irlanda),
en el dominio `.vercel.app`, con todas las variables puestas y `APP_URL`
apuntando a él; la ciudad real en el tracking leyendo las cabeceras de Vercel;
`/api/pulso` detrás de la contraseña; `robots.txt` que deja indexar la landing
y prohíbe `/panel` y `/p/`; y `npm run humo` ejecutado **contra el dominio**.
Sin cron: en el plan gratuito de Vercel solo corre una vez al día, y el
`tick()` ya lo dispara el panel mientras está abierto. Se prueba desde un móvil
con datos: la landing carga, relleno `/solicitar`, el aviso llega al Telegram
de Manolo, y `/panel` me pide la contraseña y con ella entro y veo la solicitud
en la bandeja. Commit final: «Fase 7 · A producción».

### El reparto en paralelo

Con la fase 0 hecha, las fases 1 a 7 se reparten así. Los carriles arrancan a
la vez; tú integras y commiteas cada fase en cuanto está, en orden 1 → 7,
aunque un carril termine antes que otro. La fase 7 es tuya, sin
subagentes: el despliegue no se delega.

- **Carril A · La entrada** (fases 1 y 2, encadenadas): «+ Nueva Solicitud»,
  Solicitudes, el formulario público que empieza a guardar, `extraerVisita`,
  «Convertir» con `casarConceptos` y el amarillo. Ficheros: las rutas de nueva
  solicitud y solicitudes, `src/app/solicitar/`, `src/lib/ia.ts`.
- **Carril B · El documento** (fases 3 y 4): el editor sobre los borradores
  del seed, «Enviar al cliente» con los tres textos, la página pública con
  firma y PDF, plantillas. Ficheros: la ruta del editor, `/p/[token]`,
  plantillas.
- **Carril C · El motor** (fases 5 y 6): `registrarLectura` y el endpoint de
  eventos, el timeline en frases humanas, HOY, el polling, la campana,
  Telegram agrupado, `tick()`, la persecución y el reloj completo. Se prueba
  contra el seed desde el primer minuto y se enchufa a la página pública cuando
  el carril B la entrega. Ficheros: `src/app/api/`, `src/lib/tick.ts`,
  `src/lib/telegram.ts`, los componentes de timeline y HOY.
- **Sueltas:** la página Precios (fase 2) y la página Plantillas (fase 4), un
  subagente cada una si hay capacidad; si no, dentro de su carril.

Antes de lanzar nada: los contratos de `src/lib/tipos.ts` y el reparto exacto
de ficheros por escrito en el plan. Al recibir cada carril: `npm run check`,
las rutas con `curl`, el flujo completo probado por ti de punta a punta, y el
commit de la fase.

## Las reglas de trabajo

- Trabaja por fases y en paralelo, sin parar. Anuncia cada fase al cerrarla y
  sigue. La única aprobación es la del plan.
- No inventes precios jamás. Lo desconocido, en amarillo.
- Todo lo que no sea lenguaje es determinista. La IA solo interpreta texto
  libre y redacta seguimientos.
- Nunca `npm install` después de la fase 0; nunca borres `data/demo.db` ni
  ejecutes `npm run reset` sin que te lo pida; nunca imprimas `.env.local`;
  nunca cambies el esquema sin decírmelo.
- El servidor de desarrollo lo tengo yo arrancado en otra terminal, en
  `http://localhost:3000`. No arranques otro ni lo reinicies; si algo exige
  reiniciarlo, dímelo y lo hago yo.
- Piensa antes de escribir: cada fase bien planteada a la primera vale más que
  tres iteraciones corrigiendo. Si algo falla, arréglalo tú antes de
  enseñármelo; si a la tercera no sale, dímelo con claridad y con una
  propuesta.
- Los datos del seed son de ejemplo y la interfaz los trata como tales.

Propón ahora el plan: los contratos que vas a fijar, los carriles con sus
subagentes y el reparto exacto de ficheros de cada uno, en qué orden esperas
cerrar las fases y cómo verificas cada una antes de anunciarla. Si la fase 0
ya está hecha, el plan empieza en la fase 1.

Y cuando lo apruebe, a por todas: de un tirón, sin pausas, con todos los
carriles en marcha y el listón al máximo en cada pantalla. Confío en ti para
esto.
