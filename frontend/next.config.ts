import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build output optimizado para Docker:
  // - genera .next/standalone/ con SOLO los archivos + módulos necesarios para correr
  // - excluye devDependencies que igual no se usan en runtime
  // - permite imagen final ~150 MB en lugar de ~600 MB
  // - el server.js dentro de standalone es el entrypoint
  output: "standalone",
};

export default nextConfig;
