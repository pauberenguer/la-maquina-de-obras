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
