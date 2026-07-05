import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Zama relayer SDK ships a WASM module; excluding it from Vite's dependency
// pre-bundling lets the .wasm assets resolve correctly, and `global: globalThis`
// satisfies the SDK's expectation of a Node-style global in the browser.
export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    exclude: ["@zama-fhe/relayer-sdk"],
  },
});
