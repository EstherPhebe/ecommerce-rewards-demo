//@ts-check

import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginPrettier from "eslint-plugin-prettier";
import tsParser from "@typescript-eslint/parser";

export default defineConfig([
  globalIgnores(["prisma-types/**"]),
  eslint.configs.recommended,
  {
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
    extends: [eslintConfigPrettier],
    files: ["**/*.ts"],
    plugins: {
      prettier: eslintPluginPrettier,
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
]);
