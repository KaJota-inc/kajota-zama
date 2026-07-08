import React from "react";
import ReactDOM from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ZamaProvider } from "@zama-fhe/react-sdk";
import { wagmiConfig, buildZamaConfig } from "./config";
import App from "./App";
import "./styles.css";

const queryClient = new QueryClient();
const zamaConfig = buildZamaConfig();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ZamaProvider config={zamaConfig}>
          <App />
        </ZamaProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
