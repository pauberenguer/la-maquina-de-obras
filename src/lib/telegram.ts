// El móvil del jefe. Sin librería: un fetch al Bot API.
// Si faltan las claves, los avisos se quedan en la campana del panel.
//
// DUEÑO: carril C.

/** Un aviso no puede retrasar una petición del producto más que esto. */
const ESPERA_MAXIMA_MS = 4000;

export function hayTelegram(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/**
 * Manda un mensaje al chat del jefe. Nunca lanza y nunca se queda colgado: un
 * fallo de Telegram no puede tumbar una petición del producto, así que se
 * registra y se sigue.
 */
export async function enviarTelegram(texto: string, enlace?: string): Promise<boolean> {
  if (!hayTelegram()) return false;
  const cuerpo = enlace ? `${texto}\n${enlace}` : texto;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: cuerpo,
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
      },
    );
    if (!res.ok) {
      console.error(`Telegram devolvió ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Telegram no respondió:", (e as Error).message);
    return false;
  }
}

/** La dirección pública con la que se construyen los enlaces de los avisos. */
export function urlDeLaApp(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
