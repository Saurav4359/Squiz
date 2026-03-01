import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  addDoc,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Player, Match, Question, LeaderboardEntry, DailyQuest } from '../../types';
import { DEFAULT_RATING, ROLES, UserRole } from '../../config/constants';

// ─── PLAYER OPERATIONS ─────────────────────────────────

export async function createPlayer(
  walletAddress: string,
  seekerId: string,
  username: string,
  primaryRole: UserRole
): Promise<Player> {
  const defaultRatings: Record<string, number> = {};
  ROLES.forEach(role => { defaultRatings[role] = DEFAULT_RATING; });

  const player: Player = {
    id: walletAddress,
    walletAddress,
    seekerId,
    username,
    roles: [primaryRole],
    primaryRole,
    ratings: defaultRatings as Record<UserRole, number>,
    xp: 0,
    level: 1,
    matchesPlayed: 0,
    matchesWon: 0,
    currentStreak: 0,
    bestStreak: 0,
    avgReactionTime: 0,
    badges: [],
    isSkrStaker: false,
    skrBalance: 0,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };

  await setDoc(doc(db, 'players', walletAddress), player);
  return player;
}

export async function getPlayer(walletAddress: string): Promise<Player | null> {
  const snap = await getDoc(doc(db, 'players', walletAddress));
  return snap.exists() ? (snap.data() as Player) : null;
}

export async function updatePlayer(
  walletAddress: string,
  updates: Partial<Player>
): Promise<void> {
  await updateDoc(doc(db, 'players', walletAddress), {
    ...updates,
    lastActiveAt: Date.now(),
  });
}

export async function updatePlayerRating(
  walletAddress: string,
  role: UserRole,
  newRating: number
): Promise<void> {
  await updateDoc(doc(db, 'players', walletAddress), {
    [`ratings.${role}`]: newRating,
    lastActiveAt: Date.now(),
  });
}

// ─── MATCH OPERATIONS ──────────────────────────────────

export async function createMatch(match: Match): Promise<string> {
  const docRef = await addDoc(collection(db, 'matches'), match);
  return docRef.id;
}

export async function getMatch(matchId: string): Promise<Match | null> {
  const snap = await getDoc(doc(db, 'matches', matchId));
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as Match) : null;
}

export async function updateMatch(
  matchId: string,
  updates: Partial<Match>
): Promise<void> {
  await updateDoc(doc(db, 'matches', matchId), updates);
}

export function subscribeToMatch(
  matchId: string,
  callback: (match: Match) => void
): () => void {
  return onSnapshot(doc(db, 'matches', matchId), (snap) => {
    if (snap.exists()) {
      callback({ ...snap.data(), id: snap.id } as Match);
    }
  });
}

// Find an open match waiting for an opponent
export async function findOpenMatch(
  role: UserRole,
  ratingMin: number,
  ratingMax: number,
  excludePlayerId: string
): Promise<Match | null> {
  const q = query(
    collection(db, 'matches'),
    where('status', '==', 'waiting_for_opponent'),
    where('playerA.rating', '>=', ratingMin),
    where('playerA.rating', '<=', ratingMax),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const matchDoc = snap.docs[0];
  const match = { ...matchDoc.data(), id: matchDoc.id } as Match;

  // Don't match against yourself
  if (match.playerA.id === excludePlayerId) return null;

  return match;
}

// ─── QUESTION OPERATIONS ───────────────────────────────

export async function storeQuestions(questions: Question[]): Promise<void> {
  const batch: Promise<void>[] = questions.map(q =>
    setDoc(doc(db, 'questions', q.id), q)
  );
  await Promise.all(batch);
}

export async function getUnseenQuestions(
  playerId: string,
  role: UserRole,
  count: number
): Promise<Question[]> {
  // Get seen question IDs for this player
  const seenSnap = await getDocs(
    collection(db, 'players', playerId, 'seenQuestions')
  );
  const seenIds = new Set(seenSnap.docs.map(d => d.id));

  // Get active questions for role
  const now = Date.now();
  const q = query(
    collection(db, 'questions'),
    where('role', '==', role),
    where('expiresAt', '>', now),
    orderBy('expiresAt'),
    limit(count * 3) // Fetch extra in case some are seen
  );

  const snap = await getDocs(q);
  const unseen = snap.docs
    .map(d => ({ ...d.data(), id: d.id } as Question))
    .filter(question => !seenIds.has(question.id))
    .slice(0, count);

  return unseen;
}

export async function markQuestionsAsSeen(
  playerId: string,
  questionIds: string[]
): Promise<void> {
  const promises = questionIds.map(qId =>
    setDoc(doc(db, 'players', playerId, 'seenQuestions', qId), {
      seenAt: Date.now(),
    })
  );
  await Promise.all(promises);
}

// ─── LEADERBOARD ───────────────────────────────────────

export async function getLeaderboard(
  role: UserRole,
  maxResults: number = 20
): Promise<LeaderboardEntry[]> {
  const q = query(
    collection(db, 'players'),
    orderBy(`ratings.${role}`, 'desc'),
    limit(maxResults)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d, index) => {
    const player = d.data() as Player;
    return {
      rank: index + 1,
      playerId: player.id,
      username: player.username,
      rating: player.ratings[role],
      winRate: player.matchesPlayed > 0
        ? Math.round((player.matchesWon / player.matchesPlayed) * 100)
        : 0,
      matchesPlayed: player.matchesPlayed,
      avgReactionTime: player.avgReactionTime,
      isSkrStaker: player.isSkrStaker,
      isCurrentUser: false,
    };
  });
}

// ─── DAILY QUESTS ──────────────────────────────────────

export async function getDailyQuests(playerId: string): Promise<DailyQuest[]> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const questDocId = `${playerId}_${today}`;
  const snap = await getDoc(doc(db, 'dailyQuests', questDocId));

  if (snap.exists()) {
    return snap.data().quests as DailyQuest[];
  }

  // Generate new daily quests
  const quests: DailyQuest[] = [
    {
      id: `${today}_win`,
      title: 'Win 3 Matches',
      description: 'Win 3 quiz battles today',
      type: 'win_matches',
      target: 3,
      progress: 0,
      xpReward: 75,
      isCompleted: false,
      icon: '⚔️',
    },
    {
      id: `${today}_answer`,
      title: 'Answer 10 Questions',
      description: 'Answer 10 questions correctly',
      type: 'answer_questions',
      target: 10,
      progress: 0,
      xpReward: 50,
      isCompleted: false,
      icon: '🧠',
    },
    {
      id: `${today}_skr`,
      title: 'SKR Tournament',
      description: 'Play 1 SKR-wager match',
      type: 'skr_tournament',
      target: 1,
      progress: 0,
      xpReward: 150,
      isCompleted: false,
      icon: '💎',
    },
  ];

  await setDoc(doc(db, 'dailyQuests', questDocId), { quests, date: today });
  return quests;
}

export async function updateQuestProgress(
  playerId: string,
  questType: string,
  incrementBy: number = 1
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const questDocId = `${playerId}_${today}`;
  const snap = await getDoc(doc(db, 'dailyQuests', questDocId));

  if (!snap.exists()) return;

  const quests = snap.data().quests as DailyQuest[];
  const updated = quests.map(q => {
    if (q.type === questType && !q.isCompleted) {
      const newProgress = Math.min(q.progress + incrementBy, q.target);
      return {
        ...q,
        progress: newProgress,
        isCompleted: newProgress >= q.target,
      };
    }
    return q;
  });

  await updateDoc(doc(db, 'dailyQuests', questDocId), { quests: updated });
}
