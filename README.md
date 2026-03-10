<div align="center">
  <img src="./assets/icon.png" width="150" height="150" alt="Squiz Logo">
  <h1>Squiz (SeekerRank) 🏆</h1>
  <p><b>Real-Time Web3 Trivia & Matchmaking on Solana</b></p>
</div>

<br/>

Squiz (also known as SeekerRank) is a high-performance, real-time multiplayer trivia and racing game built on Solana. It combines the thrill of fast-paced knowledge battles with the security of Web3 escrow. Players connect their Solana wallets, stake tokens, and compete in sub-100ms latency battles where the winner takes all. 

Built for the extreme demands of real-time crypto gaming, Squiz leverages **Bun**, **Socket.io**, **Neon PostgreSQL**, and **Solana Mobile Wallet Adapter** to deliver a seamless and premium mobile experience.

## ✨ Key Features

- **⚡ Real-Time Multiplayer Engine:** Powered by Bun and Socket.io, providing sub-100ms latency gameplay, "Ghost Racing" (real-time opponent progress), and O(1) matchmaking.
- **🔐 Web3 & Solana Integration:** Built-in Solana Mobile Wallet Adapter (MWA) for easy mobile wallet connections without leaving the app.
- **💰 Smart Contract Escrows:** Trustless match escrows using Anchor smart contracts. Players securely lock in their stakes before a match begins.
- **💾 Blazing Fast Storage:** Uses **MMKV** for ultra-fast local state persistence and **Neon (Serverless Postgres)** for cloud syncing of match histories and leaderboards without blocking the game thread.
- **🎨 Premium UI/UX:** Built with React Native & Expo, featuring beautiful gradients, smooth haptics (Expo Haptics), and a polished, dynamic interface.
- **🎯 Advanced Gameplay System:** Speed bonus engine, daily quests, global leaderboards, detailed match history, and comprehensive profile tracking.

## 📱 Screens & User Flow

1. **Connect Wallet:** Seamless onboarding using the Solana MWA.
2. **Home/Profile:** View stats, balance (SOL/USDC), and access Daily Quests.
3. **Deposit/Withdraw:** Fund your gaming wallet directly from your main Solana wallet.
4. **Matchmaking:** Choose a stake, get instantly paired via the in-memory queue, and lock the escrow.
5. **Battle Screen:** Answer fast-paced trivia in real-time. See your opponent's progress bar fill as they answer.
6. **Results:** Instant settlement. The smart contract automatically transfers the prize pool to the winner. 
7. **Leaderboard & Match History:** Track your global rank and review past performance.

## 🛠️ Technology Stack

### **Frontend**
- **Framework:** React Native (Expo SDK 55)
- **State Management:** Zustand
- **Local Storage:** React Native MMKV
- **Web3:** `@solana/web3.js`, `@solana-mobile/mobile-wallet-adapter-protocol`
- **UI/UX:** Reanimated, SVG, Expo Linear Gradient, FlashList

### **Backend**
- **Runtime:** Bun (for maximum throughput)
- **WebSockets:** Socket.io
- **Database:** Neon (PostgreSQL)
- **Smart Contracts:** Rust (Anchor)

## 🚀 How to Run Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Bun](https://bun.sh/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- A Solana Wallet installed on your simulator/device (e.g., Phantom or Solflare)

### 1. Start the Backend
```bash
cd backend
bun install
# Ensure Neon DB and other environment variables are set in .env
bun run server.ts
```
*The server will start on port 3000.*

### 2. Start the Mobile App
```bash
cd ..
npm install
# or yarn install

# Start the Expo bundler
npx expo start
```
*Press `i` to open in the iOS simulator or `a` for Android.*

## 🏆 Hackathon Submission Details

Squiz was built with the vision of bringing frictionless, high-stakes competitive gaming to the Solana mobile ecosystem. The primary challenges we solved include managing async state between a real-time WebSocket game loop and secure on-chain escrow transactions, all while maintaining a 60FPS React Native UI over the Solana Mobile Wallet Adapter bridge. 

**What's Next?**
- Expanding trivia categories via AI-generated questions.
- Introducing a "Royale" mode (100-player tournaments).
- Tokenomics integration and native SPL token rewards.

<br/>

<div align="center">
  <i>Built with ❤️ for the Hackathon</i>
</div>