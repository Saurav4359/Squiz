import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import {
  initializeEscrowOnChain,
  resolveMatchOnChain,
  refundMatchOnChain,
  getEscrowStatus,
} from "./escrow-resolver.js";

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
async function handleInitializeEscrow(body: any): Promise<Response> {
  const { matchId, playerA, playerB, wagerType, wagerAmount } = body;

  if (!matchId || !playerA || !playerB || !wagerType || wagerAmount == null) {
    return errorResponse(
      "Missing required fields: matchId, playerA, playerB, wagerType, wagerAmount"
    );
  }

  if (wagerType !== "sol" && wagerType !== "skr") {
    return errorResponse("wagerType must be 'sol' or 'skr'");
  }

  try {
    const txSignature = await initializeEscrowOnChain(
      matchId,
      playerA,
      playerB,
      wagerType,
      Number(wagerAmount)
    );
    return jsonResponse({ success: true, txSignature });
  } catch (err: any) {
    console.error("[POST /api/initialize-escrow] Error:", err);
    return errorResponse(err.message || "Failed to initialize escrow", 500);
  }
}

async function handleResolve(body: any): Promise<Response> {
  const { matchId, winnerPubkey, wagerType } = body;

  if (!matchId || !winnerPubkey || !wagerType) {
    return errorResponse(
      "Missing required fields: matchId, winnerPubkey, wagerType"
    );
  }

  if (wagerType !== "sol" && wagerType !== "skr") {
    return errorResponse("wagerType must be 'sol' or 'skr'");
  }

  try {
    const txSignature = await resolveMatchOnChain(
      matchId,
      winnerPubkey,
      wagerType
    );
    return jsonResponse({ success: true, txSignature });
  } catch (err: any) {
    console.error("[POST /api/resolve] Error:", err);
    return errorResponse(err.message || "Failed to resolve match", 500);
  }
}

async function handleRefund(body: any): Promise<Response> {
  const { matchId } = body;

  if (!matchId) {
    return errorResponse("Missing required field: matchId");
  }

  try {
    const txSignature = await refundMatchOnChain(matchId);
    return jsonResponse({ success: true, txSignature });
  } catch (err: any) {
    console.error("[POST /api/refund] Error:", err);
    return errorResponse(err.message || "Failed to refund match", 500);
  }
}

async function handleEscrowStatus(matchId: string): Promise<Response> {
  if (!matchId) {
    return errorResponse("Missing matchId parameter");
  }

  try {
    const status = await getEscrowStatus(matchId);
    if (!status) {
      return errorResponse("Escrow not found for this match", 404);
    }
    return jsonResponse(status);
  } catch (err: any) {
    console.error("[GET /api/escrow-status] Error:", err);
    return errorResponse(err.message || "Failed to fetch escrow status", 500);
  }
}

// ---------------------------------------------------------------------------
// Supabase realtime listener for automatic resolution
// ---------------------------------------------------------------------------
function setupRealtimeListener(): RealtimeChannel {
  const channel = supabase
    .channel("match-resolver")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "matches",
        filter: "status=eq.finished",
      },
      async (payload) => {
        const match = payload.new as any;
        const matchId = match.id as string;
        const winnerId = match.winner_id as string | null;
        const wagerType = (match.wager_type as "sol" | "skr") || "sol";

        console.log(
          `[realtime] Match ${matchId} finished. winner_id=${winnerId}`
        );

        try {
          if (winnerId) {
            // Winner exists -- resolve the match
            // winner_id here is expected to be the winner's Solana pubkey
            // or we may need to look it up from the players table
            let winnerPubkey = winnerId;

            // If winner_id is a DB user id rather than a pubkey, look up the wallet
            if (winnerId.length < 32) {
              const { data: playerData } = await supabase
                .from("players")
                .select("wallet_address")
                .eq("id", winnerId)
                .single();

              if (playerData?.wallet_address) {
                winnerPubkey = playerData.wallet_address;
              } else {
                console.error(
                  `[realtime] Could not find wallet for winner_id=${winnerId}`
                );
                return;
              }
            }

            const txSig = await resolveMatchOnChain(
              matchId,
              winnerPubkey,
              wagerType
            );

            await supabase
              .from("matches")
              .update({
                escrow_status: "resolved",
                escrow_tx: txSig,
              })
              .eq("id", matchId);

            console.log(
              `[realtime] Match ${matchId} resolved on-chain. tx=${txSig}`
            );
          } else {
            // No winner -- draw, refund both players
            const txSig = await refundMatchOnChain(matchId);

            await supabase
              .from("matches")
              .update({
                escrow_status: "refunded",
                escrow_tx: txSig,
              })
              .eq("id", matchId);

            console.log(
              `[realtime] Match ${matchId} refunded on-chain. tx=${txSig}`
            );
          }
        } catch (err) {
          console.error(
            `[realtime] Failed to process match ${matchId}:`,
            err
          );

          await supabase
            .from("matches")
            .update({ escrow_status: "error" })
            .eq("id", matchId);
        }
      }
    )
    .subscribe((status) => {
      console.log(`[realtime] Subscription status: ${status}`);
    });

  return channel;
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT) || 3001;

const server = Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Add CORS headers to all responses
    const addCors = (res: Response): Response => {
      res.headers.set("Access-Control-Allow-Origin", "*");
      return res;
    };

    try {
      // POST /api/initialize-escrow
      if (req.method === "POST" && pathname === "/api/initialize-escrow") {
        const body = await req.json();
        return addCors(await handleInitializeEscrow(body));
      }

      // POST /api/resolve
      if (req.method === "POST" && pathname === "/api/resolve") {
        const body = await req.json();
        return addCors(await handleResolve(body));
      }

      // POST /api/refund
      if (req.method === "POST" && pathname === "/api/refund") {
        const body = await req.json();
        return addCors(await handleRefund(body));
      }

      // GET /api/escrow-status/:matchId
      if (req.method === "GET" && pathname.startsWith("/api/escrow-status/")) {
        const matchId = pathname.replace("/api/escrow-status/", "");
        return addCors(await handleEscrowStatus(decodeURIComponent(matchId)));
      }

      // Health check
      if (req.method === "GET" && pathname === "/health") {
        return addCors(jsonResponse({ status: "ok" }));
      }

      return addCors(errorResponse("Not found", 404));
    } catch (err: any) {
      console.error("[server] Unhandled error:", err);
      return addCors(errorResponse("Internal server error", 500));
    }
  },
});

// Start realtime listener
const realtimeChannel = setupRealtimeListener();

console.log(`Escrow resolver server running on http://localhost:${PORT}`);
console.log(`Realtime listener active for 'matches' table updates`);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down...");
  supabase.removeChannel(realtimeChannel);
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Shutting down...");
  supabase.removeChannel(realtimeChannel);
  process.exit(0);
});
