# Fase 0 · El chasis y la puerta de la calle

Lo que hay construido antes de empezar las fases 1 a 7, y cómo comprobarlo.

## Qué hay

### La base y la librería

- **Esquema completo** en `src/db/schema.ts`: `negocio`, `partida`, `cliente`,
  `solicitud` (con su `origen`: «manolo» o «cliente»), `presupuesto`, `linea`,
  `evento_lectura`, `tarea_programada`, `evento`, `plantilla`, `aviso`, `pulso`
  (el contador que mirará el polling) y `peticion_web` (los límites por IP del
  formulario público y de la contraseña). Aplicado con `drizzle-kit push`; no
  habrá migraciones.
- **Un solo cliente de libSQL** (`src/db/index.ts`), singleton en `globalThis`.
  En local es el fichero `data/demo.db` (con WAL y `busy_timeout` de 5 s); en
  producción será Turso, con la misma `DATABASE_URL` y su `DATABASE_AUTH_TOKEN`.
- **El acceso a datos es asíncrono.** Todas las funciones de `src/lib/` que
  tocan la base devuelven una promesa; las páginas y componentes de servidor que
  leen datos son `async` y lanzan en paralelo las lecturas independientes.
- `src/lib/reloj.ts` — `ahora()` (síncrona), `cargarReloj()` (el desplazamiento
  de la demo, en memoria, una lectura por segundo como mucho), `moverReloj()` e
  `inicioDelDia()` en Europe/Madrid. Es el único fichero con `new Date()`, salvo
  `src/lib/hora-real.ts`, que da la hora real a la sesión y a los límites.
- `src/lib/eventos.ts` — `cambiarEstado()` es la única puerta de estado y está
  **condicionada en el propio UPDATE**: si dos peticiones se cruzan, solo cambia
  la primera. `cancelarTareas()` cuenta lo que de verdad ha cancelado.
- `src/lib/presupuestos.ts` — `crearPresupuesto()` reintenta con el siguiente
  número si dos altas simultáneas chocan en el índice único.
- `src/lib/importes.ts` — `calcularImportes()`: base, IVA, total, coste y margen.
  Lo usan el editor, la página pública y el seed. Todo en céntimos enteros.
- `src/lib/formato.ts` — euros, mediciones, unidades, fechas y horas en `es-ES`,
  y `formatoTitulo()`, el Title Case de toda la interfaz.
- `src/lib/consultas.ts` y `src/lib/metricas.ts` — las lecturas del panel, LOS
  NÚMEROS con su fórmula y `datosDeLaWeb()`, lo que enseña la landing.
- `src/lib/frases.ts` — cada evento del timeline convertido en una frase humana.

### El acceso

- **Una sola contraseña** (`PANEL_PASSWORD`) y una cookie firmada con HMAC-SHA256
  (`PANEL_SECRET`), `httpOnly`, 30 días. Sin tabla de usuarios ni librerías.
- `src/proxy.ts` (en Next 16 el middleware se llama «proxy») protege `/panel/*` y
  `/api/pulso`: sin sesión, `/panel` redirige a `/entrar` recordando a dónde iba,
  y el polling responde 401. Solo hace criptografía: no toca la base.
- **Segunda capa**: el layout del panel y **cada Server Action** empiezan con
  `await exigirSesion()`, porque una acción se puede invocar desde cualquier ruta
  y el proxy no la ve.
- `/entrar` limita los intentos: cinco fallos desde una IP la bloquean quince
  minutos (medidos con la hora real: mover el reloj de la demo no los levanta).
  Tras entrar, solo redirige a rutas del panel.

### Los contratos (`src/lib/tipos.ts`)

Los tipos de dominio (`Estado`, `Unidad`, `Urgencia`, `Origen`, `TipoTarea`,
`Seccion`, `TipoEvento`…) y las firmas que unen los carriles: `ExtraerVisita`,
`CasarConceptos`, `RedactarSeguimientos`, `calcularImportes`, `EnviarPresupuesto`,
`RegistrarLectura`, `Notificar` y `Tick`.

Con cuerpo puesto ya: `calcularImportes`, `notificar` (campana + Telegram) y
`enviarTelegram`. Con la firma puesta y el cuerpo por llegar: `extraerVisita`
(fase 1), `casarConceptos` (fase 2), `redactarSeguimientos` (fase 4), `tick`
(fase 6), `Pulso` y `Rastreador` (fase 5) y las acciones de la ficha (fases 3-4).
Ninguno miente: si se llama, avisa de la fase en la que llega.

### El banco de precios y el seed

- `data/base-precios.csv`: las 72 partidas de Manolo, tal cual. Se importan en un
  único lote y en el orden del CSV, que es el orden de la obra.
- `npm run reset` vacía la base **borrando sus tablas, no el fichero** (así
  funciona igual contra Turso y el servidor de desarrollo sigue viendo la misma
  base), aplica el esquema, importa el banco, carga el seed y **comprueba que
  las cifras cuadran**: si no, aborta con el número que falla.

El seed es determinista, con fechas relativas al día en que se ejecuta:

| | |
|---|---|
| Presupuestos | 37 · 2 borradores, 12 vivos, 5 ganados, 14 perdidos, 4 expirados |
| Vivos | 12 por **87.400 €** |
| Sin respuesta > 7 días | 4 por **31.200 €** |
| Ganados en 30 días | 3 por **28.900 €** |
| Tasa de firma | 1 de 6 antes del alta (17 %) · 4 de 17 después (24 %) |
| De la visita al envío | **14 días** antes · **1 día** después |
| HOY | 2 aperturas de hoy, 1 seguimiento que sale hoy, 2 que caducan en ≤3 días, 1 caducado reabierto hace 2 días |
| Solicitudes | 3 pendientes: 2 dictadas por Manolo (con conceptos) y **1 llegada de la web** (Marta Ruiz, sin conceptos ni mediciones) |
| Y además | 18 clientes, 451 líneas (1 amarilla), 152 lecturas, 105 tareas, 214 eventos, 13 avisos, 3 plantillas |

Los importes se clavan al céntimo así: cada presupuesto que sale en una cifra de
diapositiva lleva un total objetivo y dos partidas de ajuste con precios
coprimos; el seed resuelve sus mediciones (por ejemplo, 34,13 m² de picado y
10,04 m² de pintura) para que el total salga exacto.

### El estilo

- `src/app/globals.css` con la paleta de Reformas Soler en `oklch`: fondo
  `#F6F7F9`, primario `#2E6BE6`, naranja `#F28C28`, marino `#1B2537`, los siete
  pares de color de estado, el verde de positivos y el amarillo de las líneas
  fuera del banco. Radio 8 px, cuerpo a 14 px, cifras tabulares (`.cifra`).
- Componentes compartidos en `src/components/`: `Sidebar`, `PageHeader`,
  `EstadoBadge`, `Importe`, `Kpi`, `EmptyState`, `Timeline`, `Campana`,
  `BarraReloj`, `Documento` y `PanelDelPresupuesto`; y para la web,
  `CabeceraWeb`, `PieWeb` y el formulario de solicitud.
- Title Case en toda la interfaz, con `formatoTitulo()` para lo que viene de la
  base.

### Las pantallas

| Ruta | Estado |
|---|---|
| `/` · la web | **Terminada.** Portada, cifras contadas en la base, los 10 capítulos del banco con sus partidas, cómo trabajan y el pie con los datos de Ajustes. Primero móvil |
| `/solicitar` | **Montada.** El formulario completo con su validación (la misma regla en el navegador y en el servidor, `src/lib/solicitud-web.ts`) y su campo trampa. **Todavía no guarda**: lo dice al enviarlo. Se enciende en la fase 1 |
| `/entrar` | **Terminada.** La contraseña, con el límite de intentos |
| `/panel` · Inicio | **Terminada.** HOY y LOS NÚMEROS, cada cifra con su fórmula |
| `/panel/presupuestos` | **Terminada.** Kanban con total € por columna, vista lista con buscador y filtro, badge de parados |
| `/panel/presupuestos/[id]` | **Terminada para lo que toca:** documento a la izquierda; a la derecha General, Actividad y Seguimientos. Sin editor ni acciones: llegan en las fases 3 y 4 |
| `/panel/clientes` y `/panel/clientes/[id]` | **Terminadas.** Tabla con presupuestos, ganados y € contratado; ficha con historial |
| `/panel/ajustes` | **Terminada y funcional.** Empresa, IVA, caducidad, condiciones y los tres textos de seguimiento |
| `/panel/solicitudes`, `/panel/precios`, `/panel/plantillas`, `/panel/nueva-visita` | En el menú, con un mensaje que dice qué hay y en qué fase se enciende |

La barra lateral lleva las 7 entradas, «+ Nueva Solicitud», los badges de
solicitudes pendientes y de parados, la campana con el contador real de no
leídos, «Salir», y con `DEMO_MODE=1` la barra del reloj (mover el reloj ya
funciona; `tick()` se le engancha en la fase 6).

## Cómo comprobarlo

```bash
npm run check                  # sin errores de tipos
npm run reset                  # termina en «✅ Las cifras cuadran»
npm run dev                    # http://localhost:3000
```

En pantalla:

1. **La web** (`/`) enseña los 10 capítulos del banco, 18 clientes, 5 obras
   contratadas y 72 partidas con precio. En el móvil se lee entera.
2. **`/solicitar`**: enviado vacío marca siete errores en castellano; bien
   relleno, avisa de que todavía no guarda.
3. **`/panel` sin sesión** manda a `/entrar`. Con la contraseña, entra.
4. **Inicio** enseña 87.400 €, 31.200 € y 28.900 €, y un HOY con seis cosas.
5. **Presupuestos** suma 87.400 € entre Enviado, Visto y En Conversación, y el
   menú marca 4 parados en naranja y 3 solicitudes pendientes.
6. El presupuesto de **María Gómez** (Reforma integral de baño, Carrer de
   Mallorca 42) vale exactamente 14.300,00 € y está en Visto.
7. **Ajustes**: cambia el teléfono, guarda, y la web lo enseña en la cabecera y
   el pie.

## Lo que queda dicho para las fases siguientes

- `/solicitar` guarda y avisa en la fase 1 (carril A), con el límite por IP de
  `src/lib/limites.ts`, que ya existe y ya usa `/entrar`.
- La página pública `/p/[token]` todavía no existe: la construye el carril B en
  la fase 4. El enlace de la ficha ya apunta a ella.
- `src/app/api/` está vacío: lo levanta el carril C en la fase 5 (`/api/pulso`,
  `/api/lectura`) y la fase 6 (`/api/tick`). El proxy ya protege `/api/pulso`.
- El token del enlace público se genera con `crypto.randomBytes`, así que no es
  adivinable. Es lo único no determinista del seed, y no afecta a ninguna cifra.
- En el CSV del banco había cinco descripciones cortadas en el documento de
  partida (`DEM-06`, `ALB-10`, `ELE-02`, `ALI-07`, `COC-06`); se han
  reconstruido con el texto evidente. Los códigos, unidades, precios y márgenes
  son los del documento, sin tocar.
