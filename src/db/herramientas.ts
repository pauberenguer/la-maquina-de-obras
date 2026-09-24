// Herramientas de los scripts de la base (reset y turso). No las usa la app.
import { execFileSync } from "node:child_process";
import { createClient, type Client } from "@libsql/client";

export function cargarEnv() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Sin .env.local se usan las variables del entorno.
  }
}

/** Borra todas las tablas de una base, sin tocar el fichero ni la base en sí. */
export async function vaciar(url: string, authToken?: string): Promise<number> {
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

/** Aplica el esquema de src/db/schema.ts a la base indicada. */
export function aplicarEsquema(url: string, authToken?: string) {
  execFileSync("npx", ["drizzle-kit", "push", "--force"], {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url, DATABASE_AUTH_TOKEN: authToken ?? "" },
  });
}

export type { Client };
