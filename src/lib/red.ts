// Lo que sabemos de quien llama a partir de las cabeceras: su IP y, si el
// proveedor la pone, su ciudad. En local no llega nada de esto y está bien.

/** La IP del visitante, mirando las cabeceras que ponen Vercel, Cloudflare o un proxy. */
export function ipDe(cabeceras: Headers): string | null {
  const directa = cabeceras.get("cf-connecting-ip") ?? cabeceras.get("x-real-ip");
  if (directa) return directa.trim();
  const cadena = cabeceras.get("x-forwarded-for");
  if (cadena) return cadena.split(",")[0]!.trim() || null;
  return null;
}

/** Un nombre de ciudad tal y como llega en la cabecera, decodificado y limpio. */
function limpiar(valor: string | null): string | null {
  if (!valor) return null;
  try {
    return decodeURIComponent(valor).trim() || null;
  } catch {
    return valor.trim() || null;
  }
}

/**
 * Ciudad y país de quien llama. En producción los pone Vercel
 * (`x-vercel-ip-city`, codificada, y `x-vercel-ip-country`); si algún día hay
 * Cloudflare delante, sus `cf-ipcity` y `cf-ipcountry`. En local no llega nada
 * y la interfaz dice «ubicación desconocida».
 */
export function ubicacionDe(cabeceras: Headers): { ciudad: string | null; pais: string | null } {
  const ciudad = limpiar(cabeceras.get("x-vercel-ip-city") ?? cabeceras.get("cf-ipcity"));
  const pais = limpiar(cabeceras.get("x-vercel-ip-country") ?? cabeceras.get("cf-ipcountry"));
  // Cloudflare manda «XX» cuando no lo sabe.
  return { ciudad, pais: pais && pais !== "XX" ? pais : null };
}
