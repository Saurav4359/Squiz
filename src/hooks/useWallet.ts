import { useState, useCallback, useEffect, useRef } from 'react';
import {
  connectWallet,
  disconnectWallet,
  restoreSession,
  getSOLBalance,
  getSKRBalance,
  shortenAddress,
  devConnectWallet,
  WalletSession,
} from '../services/wallet/solanaWallet';
import { getSolanaWalletBalance } from '../services/explorer/solscan';
import * as Linking from 'expo-linking';
import { connectPhantom, handlePhantomConnectRedirect } from '../services/wallet/phantomWallet';

export interface WalletState {
  address: string | null;
  shortAddress: string;
  label: string;
  authToken: string | null;
  balance: {
    sol: number;
    skr: number;
  };
  connecting: boolean;
  connected: boolean;
  error: string | null;
}

export interface UseWalletReturn extends WalletState {
  connect: () => Promise<void>;
  devConnect: () => Promise<void>;
  connectPhantomWallet: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

export function useWallet(): UseWalletReturn {
  const [address, setAddress] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [balance, setBalance] = useState({ sol: 0, skr: 0 });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const balanceInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const session = await restoreSession();
        if (session) {
          setAddress(session.address);
          setLabel(session.label);
          setAuthToken(session.authToken);
        }
      } catch (err) {
        console.warn('[useWallet] Failed to restore session:', err);
      } finally {
        setRestored(true);
      }
    })();
  }, []);

  // Fetch balances when address changes
  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      const sol = await getSolanaWalletBalance(address);
      const skr = await getSKRBalance(address);
      setBalance({ sol, skr });
    } catch (err) {
      console.warn('[useWallet] Balance fetch failed:', err);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      refreshBalance();
      // Poll balance every 30s
      balanceInterval.current = setInterval(refreshBalance, 30000);
    }
    return () => {
      if (balanceInterval.current) {
        clearInterval(balanceInterval.current);
        balanceInterval.current = null;
      }
    };
  }, [address, refreshBalance]);

  // Deep Link listener for Phantom
  useEffect(() => {
    const handleDeepLink = async (event: Linking.EventType) => {
      try {
        const session = await handlePhantomConnectRedirect(event.url);
        if (session) {
          setAddress(session.address);
          setLabel(session.label);
          setAuthToken(session.authToken);
        }
      } catch (err: any) {
        setError(err?.message || 'Phantom connection failed.');
      }
    };
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  // Connect via MWA
  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const session = await connectWallet();
      setAddress(session.address);
      setLabel(session.label);
      setAuthToken(session.authToken);
    } catch (err: any) {
      // Use the specific error message if it exists, otherwise fallback to generic
      const message = err?.message || 'Wallet connection failed. Try again.';
      setError(message);
      throw err;
    } finally {
      setConnecting(false);
    }
  }, []);

  // Dev connect (emulator bypass)
  const devConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const session = await devConnectWallet();
      setAddress(session.address);
      setLabel(session.label);
      setAuthToken(session.authToken);
    } catch (err: any) {
      setError('Dev connect failed');
    } finally {
      setConnecting(false);
    }
  }, []);

  // Phantom Mobile SDK
  const connectPhantomWallet = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      await connectPhantom();
    } catch (err: any) {
      setError(err?.message || 'Failed to open Phantom Wallet');
    } finally {
      setConnecting(false);
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    await disconnectWallet();
    setAddress(null);
    setLabel('');
    setAuthToken(null);
    setBalance({ sol: 0, skr: 0 });
  }, []);

  return {
    address,
    shortAddress: address ? shortenAddress(address) : '',
    label,
    authToken,
    balance,
    connecting,
    connected: !!address,
    error,
    connect,
    devConnect,
    connectPhantomWallet,
    disconnect,
    refreshBalance,
  };
}
