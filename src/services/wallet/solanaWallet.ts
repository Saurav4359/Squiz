import { Connection, PublicKey, Transaction, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TurboModuleRegistry } from 'react-native';
import { HELIUS_RPC_URL, SKR_MINT_ADDRESS } from '../../config/constants';

// Use expo-secure-store – always available in Expo Go
import * as SecureStore from 'expo-secure-store';

// ─── Check if MWA native module exists ───────────────────
function isMWAAvailable(): boolean {
  try {
    return TurboModuleRegistry.get('SolanaMobileWalletAdapter') != null;
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
const STORAGE_PREFIX = 'seekerrank_';

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
        chain: `solana:${CLUSTER}`,
        identity: {
          name: 'SeekerRank',
          uri: 'https://seekerrank.app',
          icon: 'favicon.ico',
        },
      });

      const pubkeyBytes = auth.accounts[0].address;
      const address =
        typeof pubkeyBytes === 'string'
          ? pubkeyBytes
          : new PublicKey(pubkeyBytes).toBase58();

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

    const signature = await transact(async (wallet: any) => {
      await wallet.reauthorize({
        auth_token: authToken,
        identity: {
          name: 'SeekerRank',
          uri: 'https://seekerrank.app',
          icon: 'favicon.ico',
        },
      });

      const { blockhash } = await conn.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(walletAddr || '');

      const signedTxs = await wallet.signAndSendTransactions({
        transactions: [transaction],
      });

      return signedTxs[0];
    });

    return typeof signature === 'string'
      ? signature
      : Buffer.from(signature).toString('base64');
  } catch (err: any) {
    throw new Error(`Transaction failed: ${err?.message || 'Unknown error'}`);
  }
}


// ─── Utilities ───────────────────────────────────────────
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// ─── Dev bypass for emulator testing ─────────────────────
export async function devConnectWallet(): Promise<WalletSession> {
  const fakeChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const fakePubkey =
    'Dev' +
    Array.from({ length: 41 }, () =>
      fakeChars[Math.floor(Math.random() * fakeChars.length)]
    ).join('');

  const session: WalletSession = {
    address: fakePubkey.slice(0, 44),
    label: 'Dev Wallet',
    authToken: 'dev_token',
  };

  await storageSet(KEY_AUTH_TOKEN, session.authToken);
  await storageSet(KEY_WALLET, session.address);
  await storageSet(KEY_WALLET_LABEL, session.label);

  return session;
}
