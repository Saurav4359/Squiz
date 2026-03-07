# SeekerRank High-Performance Backend

This is the real-time engine for SeekerRank, built with **Bun** for maximum throughput and **Socket.io** for sub-100ms latency gameplay.

## 🚀 How to Run

1. Make sure you have [Bun](https://bun.sh) installed.
2. Navigate to the backend folder:
   ```bash
   cd backend
   ```
3. Start the server:
   ```bash
   bun run index.ts
   ```

The server runs on port **3000** by default.

## ⚡ Performance Features
- **O(1) Matchmaking**: In-memory queue for instant pairing.
- **Ghost Racing**: Real-time push of opponent progress to the frontend.
- **Speed Bonus Engine**: Server-compatible scoring logic.
- **Neon Persistence**: Background sync of match results for persistence without blocking the game.
