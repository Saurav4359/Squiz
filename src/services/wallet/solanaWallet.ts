import { Connection, PublicKey, Transaction, SystemProgram, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Platform } from 'react-native';
import { HELIUS_RPC_URL, SKR_MINT_ADDRESS } from '../../config/constants';

// Use expo-secure-store – always available in Expo Go
import * as SecureStore from 'expo-secure-store';

// ─── Identity ────────────────────────────────────────────
const APP_IDENTITY = {
  name: 'Squiz',
  uri: 'https://squiz.app',
  icon: 'favicon.ico',
};

// ─── Check if MWA is available (Android only) ───────────
function isMWAAvailable(): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    require('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
    return true;
  } catch {
    return false;
  }
}

// ─── Connection ──────────────────────────────────────────
const CLUSTER = 'devnet';
const RPC_ENDPOINT = HELIUS_RPC_URL || clusterApiUrl(CLUSTER);

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(RPC_ENDPOINT, 'confirmed');
  }
  return _connection;
}

// ─── Simple KV Storage (works in Expo Go) ────────────────
const STORAGE_PREFIX = 'squiz_';

async function storageSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_PREFIX + key, value);
  } catch {
    // Fallback: in-memory only
    _memoryStore[key] = value;
  }
}

async function storageGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_PREFIX + key);
  } catch {
    return _memoryStore[key] || null;
  }
}

async function storageDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_PREFIX + key);
  } catch {
    delete _memoryStore[key];
  }
}

const _memoryStore: Record<string, string> = {};

// ─── Session Keys ────────────────────────────────────────
const KEY_AUTH_TOKEN = 'auth_token';
const KEY_WALLET = 'wallet_address';
const KEY_WALLET_LABEL = 'wallet_label';

export interface WalletSession {
  address: string;
  label: string;
  authToken: string;
}

// ─── Connect Wallet via MWA ──────────────────────────────
export async function connectWallet(): Promise<WalletSession> {
  // Check if MWA native module is available (not in Expo Go)
  if (!isMWAAvailable()) {
    throw new Error(
      'MWA not available in Expo Go. Use dev connect (tap logo 3x) or build a dev client.'
    );
  }

  try {
    const { transact } = require('@solana-mobile/mobile-wallet-adapter-protocol-web3js');

    const session = await transact(async (wallet: any) => {
      const auth = await wallet.authorize({
        cluster: CLUSTER,
        identity: APP_IDENTITY,
      });

      const userAddress = auth.accounts[0].address;
      let address: string;

      // Robust address decoding (handles base64 or raw bytes)
      if (typeof userAddress === 'string') {
        if (/[+/=]/.test(userAddress)) {
          // Base64 encoded (often from Phantom)
          const bytes = new Uint8Array(Buffer.from(userAddress, 'base64'));
          address = new PublicKey(bytes).toBase58();
        } else {
          // Plain base58
          address = userAddress;
        }
      } else {
        // Raw bytes
        address = new PublicKey(userAddress).toBase58();
      }

      return {
        address,
        label: auth.accounts[0].label || 'Wallet',
        authToken: auth.auth_token,
      };
    });

    // Persist session
    await storageSet(KEY_AUTH_TOKEN, session.authToken);
    await storageSet(KEY_WALLET, session.address);
    await storageSet(KEY_WALLET_LABEL, session.label);

    return session;
  } catch (err: any) {
    if (err?.message?.includes('MWA not available')) {
      throw new Error(
        'MWA not available. This happens in Expo Go. Use a Dev Client or tap the logo 3x for Dev Mode.'
      );
    }
    throw new Error(
      err?.message?.includes('User rejected')
        ? 'Connection declined by user.'
        : 'Wallet connection failed. Install Phantom or Solflare on this device.'
    );
  }
}


// ─── Reconnect from stored session ───────────────────────
export async function restoreSession(): Promise<WalletSession | null> {
  try {
    const authToken = await storageGet(KEY_AUTH_TOKEN);
    const address = await storageGet(KEY_WALLET);
    const label = await storageGet(KEY_WALLET_LABEL);

    if (!authToken || !address) return null;

    return {
      address,
      label: label || 'Wallet',
      authToken,
    };
  } catch {
    return null;
  }
}

// ─── Disconnect ──────────────────────────────────────────
export async function disconnectWallet(): Promise<void> {
  await storageDelete(KEY_AUTH_TOKEN);
  await storageDelete(KEY_WALLET);
  await storageDelete(KEY_WALLET_LABEL);
}

// ─── Get SOL Balance ─────────────────────────────────────
export async function getSOLBalance(address: string): Promise<number> {
  try {
    const conn = getConnection();
    const pubkey = new PublicKey(address);
    const lamports = await conn.getBalance(pubkey);
    return lamports / LAMPORTS_PER_SOL;
  } catch (err) {
    console.warn('[Wallet] Failed to fetch SOL balance:', err);
    return 0;
  }
}

// ─── Get SKR Token Balance ───────────────────────────────
export async function getSKRBalance(address: string): Promise<number> {
  if (!SKR_MINT_ADDRESS) return 0;

  try {
    const conn = getConnection();
    const ownerPubkey = new PublicKey(address);
    const mintPubkey = new PublicKey(SKR_MINT_ADDRESS);

    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(ownerPubkey, {
      mint: mintPubkey,
    });

    if (tokenAccounts.value.length === 0) return 0;
    return tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
  } catch (err) {
    console.warn('[Wallet] Failed to fetch SKR balance:', err);
    return 0;
  }
}

// ─── Sign & Send Transaction ─────────────────────────────
export async function signAndSendTransaction(
  transaction: Transaction,
  authToken: string
): Promise<string> {
  if (!isMWAAvailable()) {
    throw new Error('MWA not available. Build a dev client for transaction signing.');
  }

  try {
    const { transact } = require('@solana-mobile/mobile-wallet-adapter-protocol-web3js');

    const conn = getConnection();
    const walletAddr = await storageGet(KEY_WALLET);
    if (!walletAddr) throw new Error('No wallet address saved');

    // Fetch blockhash BEFORE entering the transact session to avoid timeouts
    console.log('[Wallet] Fetching latest blockhash...');
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('processed');

    const signedTransaction = await transact(async (wallet: any) => {
      // Switch from reauthorize to authorize for better reliability
      await wallet.authorize({
        cluster: CLUSTER,
        identity: APP_IDENTITY,
      });

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(walletAddr);

      // We only SIGN in the wallet adapter for better reliability
      const signedTxs = await wallet.signTransactions({
        transactions: [transaction],
      });

      return signedTxs[0];
    });

    // Important: Wait 1s after switching back from wallet (re-establishes network)
    await new Promise(resolve => setTimeout(resolve, 1000));

    const rawTransaction = (signedTransaction as Transaction).serialize();
    let signature: string | null = null;
    let lastError: Error | null = null;

    // Retry loop for broadcasting (3 attempts)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Wallet] Send attempt ${attempt}...`);
        signature = await conn.sendRawTransaction(rawTransaction, {
          skipPreflight: true,
          maxRetries: 2,
        });
        console.log('[Wallet] Transaction sent, signature:', signature);
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Wallet] Send attempt ${attempt} failed:`, err.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!signature) throw lastError || new Error('Failed to send transaction after multiple attempts');

    // Confirm the transaction using the original blockhash info
    console.log('[Wallet] Confirming transaction...');
    const result = await conn.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');

    if (result.value.err) {
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(result.value.err)}`);
    }

    return signature;
  } catch (err: any) {
    console.error('[Wallet] signAndSendTransaction failed:', err);
    throw new Error(err?.message || 'Transaction failed');
  }
}


// ─── Send SOL to Address (for treasury deposits) ─────────
export async function sendSOLToAddress(
  toAddress: string,
  lamports: number,
  authToken: string
): Promise<string> {
  const conn = getConnection();
  const walletAddr = await storageGet(KEY_WALLET);

  if (!walletAddr) {
    throw new Error('No wallet connected');
  }

  const fromPubkey = new PublicKey(walletAddr);
  const toPubkey = new PublicKey(toAddress);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports,
    })
  );

  return await signAndSendTransaction(transaction, authToken);
}

// ─── Utilities ───────────────────────────────────────────
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
