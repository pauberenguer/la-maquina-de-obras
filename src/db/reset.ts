// npm run reset: vacía la base, vuelve a aplicar el esquema, importa el banco de
// precios y carga el seed. Es la única forma de volver al punto de partida.
//
// No borra el fichero: borra las tablas desde dentro. Así funciona igual contra
// el fichero local que contra Turso, y el servidor de desarrollo, que tiene la
// base abierta, sigue viendo la misma.
import { execFileSync } from "node:child_process";
import { createClient } from "@libsql/client";

function cargarEnv() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Sin .env.local se usan los valores por defecto.
  }
}

async function vaciar(url: string, authToken?: string) {
  const cliente = createClient({ url, authToken });
  const tablas = await cliente.execute(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '\\_%' escape '\\'",
  );
  await cliente.execute("PRAGMA foreign_keys = OFF");
  for (const fila of tablas.rows) {
    await cliente.execute(`DROP TABLE IF EXISTS "${String(fila.name)}"`);
  }
  cliente.close();
  return tablas.rows.length;
}

async function main() {
  cargarEnv();
  const url = process.env.DATABASE_URL || "file:./data/demo.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;
  console.log(`· base: ${url.startsWith("file:") ? url : "remota (Turso)"}`);

  const borradas = await vaciar(url, authToken);
  console.log(`· base vaciada (${borradas} tablas)`);

  execFileSync("npx", ["drizzle-kit", "push", "--force"], { stdio: "pipe", env: process.env });
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
