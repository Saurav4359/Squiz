import { serve } from "bun";
import { Server } from "socket.io";
import { neon } from "@neondatabase/serverless";
import { Redis } from "@upstash/redis";

// CONFIGURATION
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_vi0wBxOmL5Vu@ep-billowing-hill-aiaqq84o-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(DATABASE_URL);

// High-speed In-memory Queue & Match Storage (Can upgrade to Redis later)
// Sorted Sets by Rating + Filter by Role & Wager Type
const queue: Map<string, { socketId: string; userId: string; username: string; rating: number; role: string; wagerType: string }> = new Map();
const activeMatches: Map<string, any> = new Map();

console.log(`🚀 SeekerRank High-Performance Backend starting on port ${PORT}...`);

const server = serve({
  port: PORT,
  fetch(req, server) {
    if (server.upgrade(req)) return;
    return new Response("SeekerRank Real-time Engine Up");
  },
  websocket: {
    message(ws, message) {},
    open(ws) {},
    close(ws) {},
  },
});

// Using Socket.io for easy room management and reliability
const io = new Server(server as any, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  // 1. JOIN MATCHMAKING QUEUE (Instant-Match logic)
  socket.on("join_queue", ({ userId, username, rating, role, wagerType }) => {
    console.log(`[Queue] ${username} searching for ${role} match...`);
    
    // Check if an opponent already in queue
    let opponentId: string | null = null;
    for (const [id, entry] of queue.entries()) {
      if (
        entry.role === role && 
        entry.wagerType === wagerType && 
        entry.userId !== userId
      ) {
        opponentId = id;
        break;
      }
    }

    if (opponentId) {
      // MATCH FOUND! 🚀
      const opponent = queue.get(opponentId)!;
      queue.delete(opponentId);
      
      const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const matchData = {
        id: matchId,
        playerA: { id: userId, username, rating, score: 0, answers: [] },
        playerB: { id: opponent.userId, username: opponent.username, rating: opponent.rating, score: 0, answers: [] },
        status: "starting",
        role,
        wagerType,
      };

      activeMatches.set(matchId, matchData);
      
      // Notify both players instantly
      socket.join(matchId);
      io.to(opponent.socketId).socketsJoin(matchId);
      
      io.to(matchId).emit("match_found", matchData);
      console.log(`⚔️ Match Created: ${username} vs ${opponent.username}`);
    } else {
      // Wait in queue
      queue.set(socket.id, { socketId: socket.id, userId, username, rating, role, wagerType });
    }
  });

  // 2. REAL-TIME GAMEPLAY (Sub-100ms Push)
  socket.on("submit_answer", ({ matchId, userId, answer }) => {
    const match = activeMatches.get(matchId);
    if (!match) return;

    const isA = match.playerA.id === userId;
    const player = isA ? match.playerA : match.playerB;
    const opponent = isA ? match.playerB : match.playerA;

    player.answers.push(answer);
    if (answer.isCorrect) player.score += (50 + answer.speedBonus);

    // Push progress to opponent for "Ghost Racing" UI
    socket.to(matchId).emit("opponent_progress", { 
      score: player.score, 
      answerCount: player.answers.length 
    });

    // Check if both finished
    if (match.playerA.answers.length >= 5 && match.playerB.answers.length >= 5) {
      match.status = "finished";
      io.to(matchId).emit("match_finished", match);
      activeMatches.delete(matchId);
      persistResult(match); // Persist to Neon DB in background
    }
  });

  socket.on("disconnect", () => {
    queue.delete(socket.id);
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

async function persistResult(match: any) {
  try {
    // Write match summary to Neon for analytics/persistence
    await sql`
      INSERT INTO matches (id, playera, playerb, winnerid, role, createdat)
      VALUES (${match.id}, ${JSON.stringify(match.playerA)}, ${JSON.stringify(match.playerB)}, ${match.winnerId || null}, ${match.role}, ${Date.now()})
    `;
  } catch (e) {
    console.warn("[DB] Result persistence failed:", e);
  }
}