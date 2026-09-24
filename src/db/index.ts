// Un solo cliente de libSQL en todo el proceso. En local la base es el fichero
// data/demo.db; en Vercel, Turso (DATABASE_URL + DATABASE_AUTH_TOKEN). Next
// recarga los módulos en desarrollo, así que el cliente se guarda en globalThis
// para no abrir la base dos veces.
//
// Todo el acceso es ASÍNCRONO: cada consulta devuelve una promesa y se espera.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function abrir() {
  const url = process.env.DATABASE_URL || "file:./data/demo.db";
  const cliente = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });

  // En el fichero local, lo mismo que tenía la base de siempre: WAL, cinco
  // segundos de espera si otro proceso (el seed) la tiene ocupada y claves
  // ajenas activas. Con el cliente local se ejecutan en el acto, antes que
  // cualquier consulta. Turso gestiona esto en su lado.
  if (url.startsWith("file:")) {
    for (const pragma of ["journal_mode = WAL", "busy_timeout = 5000", "foreign_keys = ON"]) {
      cliente.execute(`PRAGMA ${pragma}`).catch(() => {});
    }
  }
  return drizzle(cliente, { schema });
}

const global = globalThis as typeof globalThis & { __maquinaDeObrasLibsql?: ReturnType<typeof abrir> };

export const db = (global.__maquinaDeObrasLibsql ??= abrir());
export { schema };
export * from "./schema";
