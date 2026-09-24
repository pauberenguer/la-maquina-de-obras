// npm run reset: vacía la base, vuelve a aplicar el esquema, importa el banco de
// precios y carga el seed. Es la única forma de volver al punto de partida.
//
// No borra el fichero: borra las tablas desde dentro. Así funciona igual contra
// el fichero local que contra Turso, y el servidor de desarrollo, que tiene la
// base abierta, sigue viendo la misma.
import { aplicarEsquema, cargarEnv, vaciar } from "./herramientas";

async function main() {
  cargarEnv();
  const url = process.env.DATABASE_URL || "file:./data/demo.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;
  console.log(`· base: ${url.startsWith("file:") ? url : "remota (Turso)"}`);

  const borradas = await vaciar(url, authToken);
  console.log(`· base vaciada (${borradas} tablas)`);

  aplicarEsquema(url, authToken);
  console.log("· esquema aplicado");

  const { sembrar } = await import("./seed");
  const { fallos, resumen } = await sembrar();
  console.log(`· banco de precios importado y ${resumen.length} presupuestos sembrados`);

  const ajustados = resumen.filter((r) => r.ajuste);
  if (ajustados.length) {
    console.log("\nMediciones calculadas para clavar los importes:");
    for (const r of ajustados) console.log(`  ${r.ref.padEnd(4)} ${r.ajuste}`);
  }

  if (fallos.length) {
    console.error("\n❌ El seed no cuadra:");
    for (const f of fallos) console.error(`  · ${f}`);
    process.exit(1);
  }
  console.log("\n✅ Las cifras cuadran: 12 vivos · 87.400 € · 4 sin respuesta · 31.200 € · 3 ganados · 28.900 €");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
