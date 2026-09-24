import type { NextConfig } from "next";

// @libsql/client ya está en la lista de paquetes externos de Next: no hace
// falta declararlo aquí.
const nextConfig: NextConfig = {
  // «Recargar el Banco» lee data/base-precios.csv del disco: en Vercel el
  // fichero tiene que viajar con la función de la página Precios.
  outputFileTracingIncludes: {
    "/panel/precios": ["./data/base-precios.csv"],
  },
};

export default nextConfig;
