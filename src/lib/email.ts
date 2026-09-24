// El seguimiento por email, opcional. Sin librería: un fetch a la API de Resend.
// Si no hay claves, el seguimiento solo queda registrado en el timeline y en la
// campana; nada se rompe.
//
// DUEÑO: carril C.

export function hayEmail(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_TO);
}

/** El remitente. Sin dominio propio verificado, el de pruebas de Resend. */
function remitente(): string {
  return process.env.RESEND_FROM || "Reformas Soler <onboarding@resend.dev>";
}

/**
 * Manda el correo al buzón de RESEND_TO. Nunca lanza: un fallo de email no
 * puede tumbar el latido ni una petición del producto, así que se registra y
 * se sigue. Devuelve si ha salido de verdad.
 */
export async function enviarEmail(asunto: string, texto: string): Promise<boolean> {
  if (!hayEmail()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: remitente(),
        to: [process.env.RESEND_TO],
        subject: asunto,
        text: texto,
      }),
    });
    if (!res.ok) {
      console.error(`Resend devolvió ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Resend no respondió:", (e as Error).message);
    return false;
  }
}
