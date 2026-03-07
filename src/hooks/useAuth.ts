import { useState, useCallback, useEffect } from 'react';
import { createPlayer, getPlayer, updatePlayer, getDailyQuests, loginPlayer } from '../services/db/database';
import { Player, DailyQuest } from '../types';

export interface UseAuthReturn {
  player: Player | null;
  isNewUser: boolean;
  loading: boolean;
  dailyQuests: DailyQuest[];
  signIn: (walletAddress: string) => Promise<void>;
  createProfile: (
    walletAddress: string,
    username: string,
    password?: string,
    twitter?: string,
    seekerId?: string
  ) => Promise<void>;
  refreshPlayer: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  error: string | null;
}

export function useAuth(): UseAuthReturn {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyQuests, setDailyQuests] = useState<DailyQuest[]>([]);
  const [currentWallet, setCurrentWallet] = useState<string | null>(null);

  // Check DB for player profile based on wallet address
  const signIn = useCallback(async (walletAddress: string) => {
    setLoading(true);
    setError(null);
    try {
      // Check if player exists
      const existingPlayer = await getPlayer(walletAddress);

      if (existingPlayer) {
        setPlayer(existingPlayer);
        setIsNewUser(false);
        setCurrentWallet(walletAddress);

        // Update last active
        await updatePlayer(walletAddress, { lastActiveAt: Date.now() });

        // Fetch daily quests
        try {
          const quests = await getDailyQuests(walletAddress);
          setDailyQuests(quests);
        } catch (err) {
          console.warn('[useAuth] Failed to fetch daily quests:', err);
        }
      } else {
        // New user — needs to create profile
        setIsNewUser(true);
        setCurrentWallet(walletAddress);
      }
    } catch (err: any) {
      console.error('[useAuth] Sign in failed:', err);
      let msg = err?.message || 'Authentication failed.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new player profile
  const createProfile = useCallback(
    async (
      walletAddress: string,
      username: string,
      password?: string,
      twitter?: string,
      seekerId?: string
    ) => {
      setLoading(true);
      try {
        const newPlayer = await createPlayer(
          walletAddress,
          seekerId || '',
          username,
          password,
          twitter
        );
        setPlayer(newPlayer);
        setIsNewUser(false);
        setCurrentWallet(walletAddress);

        // Initialize daily quests
        try {
          const quests = await getDailyQuests(walletAddress);
          setDailyQuests(quests);
        } catch (err) {
          console.warn('[useAuth] Failed to init daily quests:', err);
        }
      } catch (err) {
        console.error('[useAuth] Create profile failed:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Refresh player data
  const refreshPlayer = useCallback(async () => {
    if (!currentWallet) return;
    try {
      const fresh = await getPlayer(currentWallet);
      if (fresh) {
        setPlayer(fresh);
      }
      const quests = await getDailyQuests(currentWallet);
      setDailyQuests(quests);
    } catch (err) {
      console.warn('[useAuth] Refresh failed:', err);
    }
  }, [currentWallet]);

  // Traditional login with username/password
  const login = useCallback(async (username: string, password: string) => {
    if (!currentWallet) throw new Error('Connect wallet first');
    setLoading(true);
    setError(null);
    try {
      const p = await loginPlayer(username, password, currentWallet);
      if (p) {
        setPlayer(p);
        setIsNewUser(false);
        // Refresh quests
        try {
          const quests = await getDailyQuests(currentWallet);
          setDailyQuests(quests);
        } catch (err) {}
      } else {
        throw new Error('Invalid username or password');
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentWallet]);

  // Sign out
  const signOut = useCallback(() => {
    setPlayer(null);
    setIsNewUser(false);
    setCurrentWallet(null);
    setDailyQuests([]);
  }, []);

  return {
    player,
    isNewUser,
    loading,
    dailyQuests,
    signIn,
    createProfile,
    refreshPlayer,
    login,
    signOut,
    error,
  };
}
