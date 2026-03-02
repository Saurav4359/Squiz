import { PublicKey } from "@solana/web3.js";
import { HELIUS_RPC_URL } from "../../config/constants";

// Use public fallback mainnet if helius devnet isn't strictly requested for explorer duties
const RPC_ENDPOINT = HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";

const fetchSolanaData = async (method: string, params: any[]) => {
  const response = await fetch(RPC_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
};

// Returns balance in SOL
export const getSolanaWalletBalance = async (address: string): Promise<number> => {
  try {
    // Validate address before throwing non-base58 crashes natively
    new PublicKey(address);
    const balanceInLamports = await fetchSolanaData("getBalance", [address]);
    return balanceInLamports.value / 1e9; // Convert Lamports to SOL
  } catch (error) {
    console.warn(`Failed to fetch wallet balance for ${address}:`, error);
    return 0;
  }
};

export const getSolanaTransactionHistory = async (address: string, limit: number = 20) => {
  try {
    new PublicKey(address);
    const signatures = await fetchSolanaData("getSignaturesForAddress", [
      address,
      { limit },
    ]);
    return signatures;
  } catch (error) {
    console.warn(`Failed to fetch signatures for ${address}:`, error);
    return [];
  }
};
