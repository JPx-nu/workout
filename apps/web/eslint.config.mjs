import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // ── Scaffold stage: React compiler rules downgraded ──
      // useFrame (R3F), Date.now(), DOM mutations in effects,
      // and standard mounted-state patterns conflict with these.
      // Re-enable when the codebase matures past scaffold stage.
      'react-hooks/purity': 'off',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/draco/**",   // WASM/JS decoder files — third-party, not our code
  ]),
]);

export default eslintConfig;
