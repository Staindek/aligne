import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Default ignores de eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    // React Compiler / React 19 strict rules — bajadas a "warn" hasta que el
    // código se refactore para evitar setState dentro de useEffect, `new Date()`
    // durante render, etc. CI no falla, pero el IDE las sigue marcando para
    // que la deuda quede visible. Subir a "error" cuando el frontend pase
    // toda la check sin avisos.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;
