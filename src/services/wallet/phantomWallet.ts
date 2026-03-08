import 'react-native-get-random-values';
import * as Linking from 'expo-linking';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import { WalletSession } from './solanaWallet';

const CLUSTER = 'mainnet-beta';
const STORAGE_PREFIX = 'squiz_phantom_';
const APP_URL = 'https://squiz.app';

let dAppKeyPair: nacl.BoxKeyPair | null = null;

// Simple KV Storage for Phantom sessions
export async function storageSet(key: string, value: string): Promise<void> {
  try { await SecureStore.setItemAsync(STORAGE_PREFIX + key, value); } catch {}
}

export async function storageGet(key: string): Promise<string | null> {
  try { return await SecureStore.getItemAsync(STORAGE_PREFIX + key); } catch { return null; }
}

export async function storageDelete(key: string): Promise<void> {
  try { await SecureStore.deleteItemAsync(STORAGE_PREFIX + key); } catch {}
}

export async function connectPhantom(): Promise<void> {
  dAppKeyPair = nacl.box.keyPair(); // Generate fresh keypair
  const redirectLink = Linking.createURL('onPhantomConnect');
  const dAppPubKey = bs58.encode(dAppKeyPair.publicKey);
  
  const phantomUrl = `https://phantom.app/ul/v1/connect?app_url=${encodeURIComponent(APP_URL)}&dapp_encryption_public_key=${dAppPubKey}&redirect_link=${encodeURIComponent(redirectLink)}&cluster=${CLUSTER}`;
  
  await Linking.openURL(phantomUrl);
}

// Decrypt payload from Phantom
export function decryptPhantomPayload(data: string, nonce: string, sharedSecret: Uint8Array) {
  const decryptedData = nacl.box.open.after(
    bs58.decode(data),
    bs58.decode(nonce),
    sharedSecret
  );
  if (!decryptedData) throw new Error("Unable to decrypt data");
  
  // Convert Uint8Array to string safely
  let resultStr = "";
  for (let i = 0; i < decryptedData.length; i++) {
    resultStr += String.fromCharCode(decryptedData[i]);
  }
  
  return JSON.parse(resultStr);
}

export async function handlePhantomConnectRedirect(url: string): Promise<WalletSession | null> {
  const parsed = Linking.parse(url);
  
  if (parsed.path !== 'onPhantomConnect' && !url.includes('onPhantomConnect')) {
     return null;
  }
  
  const queryParams = parsed.queryParams;
  
  if (queryParams?.errorCode) {
    throw new Error(`Phantom connection failed: ${queryParams.errorMessage}`);
  }

  const phantomPublicKeyBase58 = queryParams?.phantom_encryption_public_key as string;
  const data = queryParams?.data as string;
  const nonce = queryParams?.nonce as string;

  if (!phantomPublicKeyBase58 || !data || !nonce) {
     throw new Error("Invalid redirect from Phantom");
  }

  const phantomPublicKey = bs58.decode(phantomPublicKeyBase58);
  
  if (!dAppKeyPair) throw new Error("No dApp session key found");
  
  const sharedSecret = nacl.box.before(phantomPublicKey, dAppKeyPair.secretKey);

  const decrypted = decryptPhantomPayload(data, nonce, sharedSecret);

  const session: WalletSession = {
    address: decrypted.public_key,
    label: 'Phantom Wallet',
    authToken: decrypted.session,
  };

  // Save the shared secret and session string
  await storageSet('session', decrypted.session);
  await storageSet('sharedSecret', bs58.encode(sharedSecret));
  await storageSet('phantomPublicKey', phantomPublicKeyBase58);

  return session;
}
