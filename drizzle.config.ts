import { defineConfig } from "drizzle-kit";

// La misma base que usa la app. En local, DATABASE_URL es el fichero de
// data/demo.db; en Vercel, la URL de Turso con su DATABASE_AUTH_TOKEN. Lo que
// venga ya en el entorno manda sobre .env.local: así un script puede apuntar a
// Turso sin tocar el fichero.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local se usan los valores por defecto.
}

export default defineConfig({
  dialect: "turso",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL || "file:./data/demo.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  },
});
