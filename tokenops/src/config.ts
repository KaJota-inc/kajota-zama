import { http, createPublicClient, createWalletClient, custom, type Address } from "viem";
import { sepolia } from "viem/chains";
import { createConfig as createWagmiConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { createConfig as createZamaConfig } from "@zama-fhe/sdk/viem";
import { web } from "@zama-fhe/sdk/web";
import { sepolia as sepoliaFhe } from "@zama-fhe/sdk/chains";
import { DEPLOYED_ADDRESSES } from "@tokenops/sdk";

export const RPC_URL = "https://sepolia.drpc.org";

// TokenOps test-token pair on Sepolia (resolved from the SDK's deployed addresses).
export const CTTT = DEPLOYED_ADDRESSES.testnetFaucet.confidentialTestToken["11155111"] as Address;
export const DISPERSE_SINGLETON = DEPLOYED_ADDRESSES.fheDisperse.disperseConfidentialSingleton["11155111"] as Address;
export const CTTT_DECIMALS = 6;

export const wagmiConfig = createWagmiConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: { [sepolia.id]: http(RPC_URL) },
});

const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
const fheChain = { ...sepoliaFhe, network: RPC_URL } as const;

// The Zama config powers FHE encrypt/decrypt via the relayer. The wallet client
// falls back to HTTP when no injected wallet is present (config still builds).
export function buildZamaConfig() {
  const eth = (window as unknown as { ethereum?: unknown }).ethereum;
  const walletClient = createWalletClient({
    chain: sepolia,
    transport: eth ? custom(eth as never) : http(RPC_URL),
  });
  return createZamaConfig({
    chains: [fheChain],
    publicClient,
    walletClient,
    relayers: { [fheChain.id]: web() },
  });
}
