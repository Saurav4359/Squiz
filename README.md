# Squiz (SeekerRank)

Squiz is a real-time multiplayer trivia game for Solana wallets. Players connect a wallet, create a profile, get matched with an opponent, answer timed multiple-choice questions, and compete for SOL or SKR wagers.

The app is built as a mobile experience with React Native and Expo, backed by Supabase for player data and realtime matchmaking. A Bun server handles treasury deposits, payouts, and refunds.

## What it includes

- Wallet-based sign-in and profile creation
- Realtime matchmaking
- Timed trivia battles
- Daily quests and XP progression
- Ratings, match history, and leaderboards
- Treasury deposit and payout handling

## Screens

- Connect Wallet
- Home and Profile
- Deposit
- Matchmaking
- Battle
- Results
- Leaderboard
- Match History
- Daily Quests

## Tech Stack

- Frontend: React Native, Expo, Zustand
- Wallets: Solana Mobile Wallet Adapter, `@solana/web3.js`
- Backend: Bun, Hono, Supabase
- Storage: Supabase/PostgreSQL, local app storage

## Run Locally

### Backend

```bash
cd backend
bun install
bun run server.ts
```

### Mobile App

```bash
cd ..
npm install
npx expo start
```

## Notes

- The README intentionally keeps the wording simple and direct.
- Some parts of the original project description mention Anchor and smart contract escrow, but the current codebase mainly uses a treasury server for deposits and payouts.
