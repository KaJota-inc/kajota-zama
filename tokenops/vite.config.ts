import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Zama FHE SDK ships WASM; exclude from pre-bundling and define a Node-style
// global so it resolves in the browser.
export default defineConfig({
  plugins: [react()],
  define: { global: "globalThis" },
  optimizeDeps: {
    exclude: ["@zama-fhe/sdk", "@zama-fhe/react-sdk", "@zama-fhe/relayer-sdk"],
  },
});
