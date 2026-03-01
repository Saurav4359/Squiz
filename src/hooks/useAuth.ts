import { useState, useCallback, useEffect } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../config/firebase';
import { createPlayer, getPlayer, updatePlayer } from '../services/firebase/firestore';
import { Player, DailyQuest } from '../types';
import { UserRole, DEFAULT_RATING, ROLES } from '../config/constants';
import { getDailyQuests } from '../services/firebase/firestore';

export interface UseAuthReturn {
  player: Player | null;
  isNewUser: boolean;
  loading: boolean;
  dailyQuests: DailyQuest[];
  signIn: (walletAddress: string) => Promise<void>;
  createProfile: (
    walletAddress: string,
    username: string,
    primaryRole: UserRole,
    seekerId?: string
  ) => Promise<void>;
  refreshPlayer: () => Promise<void>;
  signOut: () => void;
}

export function useAuth(): UseAuthReturn {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dailyQuests, setDailyQuests] = useState<DailyQuest[]>([]);
  const [currentWallet, setCurrentWallet] = useState<string | null>(null);

  // Sign into Firebase anonymously and check Firestore for player profile
  const signIn = useCallback(async (walletAddress: string) => {
    setLoading(true);
    try {
      // Firebase anonymous auth
      await signInAnonymously(auth);

      // Check if player exists in Firestore
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
    } catch (err) {
      console.error('[useAuth] Sign in failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new player profile in Firestore
  const createProfile = useCallback(
    async (
      walletAddress: string,
      username: string,
      primaryRole: UserRole,
      seekerId?: string
    ) => {
      setLoading(true);
      try {
        const newPlayer = await createPlayer(
          walletAddress,
          seekerId || '',
          username,
          primaryRole
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

  // Refresh player data from Firestore
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
    signOut,
  };
}
