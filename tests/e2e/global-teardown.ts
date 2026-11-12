// P8 — teardown lives in global-setup.ts (exports default setup + named
// globalTeardown); kept as a separate file because playwright.config.ts
// expects distinct globalSetup/globalTeardown paths.
export { globalTeardown as default } from "./global-setup";
