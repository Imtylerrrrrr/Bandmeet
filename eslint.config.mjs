import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 메신저봇R(Rhino) 기기 템플릿 — 앱 소스 아님, 기기에서 조정.
    "bot/**",
    // 로컬 DB 스모크 스크립트(개발 도구).
    "scripts/**",
  ]),
]);

export default eslintConfig;
