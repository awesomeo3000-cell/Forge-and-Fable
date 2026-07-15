import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Portraits are pre-sized local 512px assets (and user-supplied URLs)
      // rendered through CharacterPortrait's own crop math; next/image adds
      // a loader hop and layout constraints without benefit here. Keeps
      // lint:ci (--max-warnings=0) green.
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "QA/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
