// Prueba de humo de La Máquina de Obras: la API de OpenAI, Telegram, APP_URL y
// la base de producción en Turso.
// Se ejecuta con `npm run humo`. No imprime ninguna clave.
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

let fallos = 0;
const ok = (m: string) => console.log("✅", m);
const ko = (m: string) => {
  console.log("❌", m);
  fallos++;
};
const aviso = (m: string) => console.log("·", m);

function cargarEnv() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    aviso(".env.local no encontrado: se usan las variables del entorno");
  }
}

async function apiDeOpenAI() {
  if (!process.env.OPENAI_API_KEY) return ko("OPENAI_API_KEY no está en .env.local");
  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL ?? "gpt-5.6-terra";
  const effort = (process.env.OPENAI_EFFORT ?? "high") as "low" | "medium" | "high";
  const Esquema = z.object({ partida: z.string(), medicion: z.number(), unidad: z.string() });
  const t0 = Date.now();
  const r = await client.responses.parse({
    model,
    reasoning: { effort },
    input: [
      {
        role: "user",
        content: "Extrae la partida, la medición y la unidad: «alicatar unos 22 metros de pared».",
      },
    ],
    text: { format: zodTextFormat(Esquema, "extraccion") },
  });
  const p = r.output_parsed;
  if (!p) return ko("La API respondió pero sin salida estructurada");
  ok(
    `API de OpenAI (${model}, esfuerzo ${effort}) en ${((Date.now() - t0) / 1000).toFixed(1)} s: «${p.partida}» · ${p.medicion} ${p.unidad}`,
  );
}

type Updates = { result?: Array<{ message?: { chat: { id: number; first_name?: string } } }> };

async function telegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return aviso("Telegram sin configurar: los avisos irán solo a la campana del panel");
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!chat) {
    const u = (await fetch(`https://api.telegram.org/bot${token}/getUpdates`).then((r) => r.json())) as Updates;
    const m = (u.result ?? []).find((x) => x.message)?.message;
    if (!m)
      return ko(
        "TELEGRAM_CHAT_ID está vacío y el bot no ha recibido ningún mensaje: escríbele «hola» desde tu móvil y repite npm run humo",
      );
    return ko(
      `TELEGRAM_CHAT_ID está vacío. El bot ha recibido un mensaje de ${m.chat.first_name ?? "alguien"}: pon TELEGRAM_CHAT_ID=${m.chat.id} en .env.local y repite npm run humo`,
    );
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text: "🔧 Prueba de humo de La Máquina de Obras: el móvil del jefe recibe los avisos.",
    }),
  });
  if (res.ok) ok("Telegram: mensaje enviado al móvil del jefe");
  else ko(`Telegram: ${res.status} ${await res.text()}`);
}

async function appUrl() {
  const url = process.env.APP_URL || "http://localhost:3000";
  try {
    const res = await fetch(url, { redirect: "manual" });
    if (res.status < 500) ok(`APP_URL responde: ${url} (${res.status})`);
    else ko(`APP_URL ${url} devuelve ${res.status}`);
  } catch (e) {
    ko(`APP_URL ${url} no responde (¿está arrancado npm run dev?): ${(e as Error).message}`);
  }
}

type Pipeline = { results?: Array<{ type: string; error?: { message: string } }> };

/** La base de producción, por la API HTTP de Turso: sin depender del cliente. */
async function turso() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url || !token) return aviso("Turso sin configurar: hasta la fase 7 no hace falta");
  const t0 = Date.now();
  const res = await fetch(`${url.replace(/^libsql:\/\//, "https://")}/v2/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      requests: [{ type: "execute", stmt: { sql: "select 1" } }, { type: "close" }],
    }),
  });
  if (!res.ok) return ko(`Turso: ${res.status} ${await res.text()}`);
  const r = (await res.json()) as Pipeline;
  const primero = r.results?.[0];
  if (primero?.type !== "ok") return ko(`Turso: ${primero?.error?.message ?? "respuesta inesperada"}`);
  ok(`Turso responde en ${Date.now() - t0} ms`);
}

async function main() {
  cargarEnv();
  await apiDeOpenAI().catch((e) => ko(`API de OpenAI: ${(e as Error).message}`));
  await telegram().catch((e) => ko(`Telegram: ${(e as Error).message}`));
  await appUrl();
  await turso().catch((e) => ko(`Turso: ${(e as Error).message}`));
  console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : "\nTodo listo.");
  process.exit(fallos ? 1 : 0);
}

main();
