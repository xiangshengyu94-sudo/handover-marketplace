import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const privilegedImportRule = {
  "no-restricted-imports": [
    "error",
    {
      paths: [
        {
          name: "@/lib/supabase/admin",
          message:
            "Use a named privileged adapter; feature code must not import the Admin client.",
        },
      ],
    },
  ],
};

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: privilegedImportRule,
  },
  {
    files: [
      "src/lib/auth/admin.ts",
      "src/lib/contact/admin.ts",
      "src/lib/email/dispatcher.ts",
      "src/lib/images/process.ts",
      "src/lib/assisted/claims.ts",
      "src/lib/moderation/actions.ts",
      "src/lib/roles/manage.ts",
      "src/lib/privacy/delete-account.ts",
      "src/lib/privacy/export.ts",
      "src/lib/retention/**/*.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([
    ".next/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
