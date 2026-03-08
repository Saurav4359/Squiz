import { supabase } from '../../config/supabase';

const HEARTBEAT_MS = 10000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let trackedPlayerId: string | null = null;

async function writePresence(playerId: string) {
  const { error } = await supabase.from('app_presence').upsert({
    player_id: playerId,
    last_seen: Date.now(),
  });

  if (error) {
    console.warn('[Presence] Failed to upsert app_presence:', error.message);
  }
}

export function startPresenceHeartbeat(playerId: string) {
  trackedPlayerId = playerId;
  void writePresence(playerId);

  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    void writePresence(playerId);
  }, HEARTBEAT_MS);
}

export function stopPresenceHeartbeat(playerId?: string) {
  const id = playerId || trackedPlayerId;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  trackedPlayerId = null;

  if (!id) return;

  (async () => {
    const { error } = await supabase
      .from('app_presence')
      .delete()
      .eq('player_id', id);
    if (error) {
      console.warn('[Presence] Failed to delete app_presence:', error.message);
    }
  })();
}
