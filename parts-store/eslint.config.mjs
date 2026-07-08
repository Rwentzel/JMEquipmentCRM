import next from "eslint-config-next";

/** Flat config for ESLint 9 — `next lint` was removed in Next 16. */
export default [
  ...next,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
];
