// Central place to decide whether the app is running in public "demo" mode.
//
// Two ways to switch a deployment into demo mode (either one wins):
//   1. Runtime: the deploy pipeline writes /assets/runtime-config.js, which sets
//      window.FAMILY_EXPENSES_APP_MODE = "demo". This lets the same build behave
//      differently per environment without rebuilding.
//   2. Build-time: VITE_APP_MODE=demo when running `vite build` (handy for local
//      `npm run dev` / `npm run build`).
//
// Anything else defaults to "live" — i.e. fail secure, auth required.
export function getAppMode() {
  if (import.meta.env.VITE_APP_MODE === "demo") return "demo";
  if (typeof window !== "undefined" && window.FAMILY_EXPENSES_APP_MODE === "demo") {
    return "demo";
  }
  return "live";
}

export const isDemoMode = () => getAppMode() === "demo";
