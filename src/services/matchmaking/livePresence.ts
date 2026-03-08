import { supabase } from '../../config/supabase';

type ActiveListener = (count: number) => void;

let presenceChannel: any = null;
let trackedPlayerId: string | null = null;
let channelPresenceKey: string | null = null;
let subscribed = false;
const listeners = new Set<ActiveListener>();

function emitActiveCount() {
  if (!presenceChannel) {
    for (const cb of listeners) cb(0);
    return;
  }

  const state = presenceChannel.presenceState() as Record<string, any[]>;
  const activeCount = Object.keys(state || {}).length;
  for (const cb of listeners) cb(activeCount);
}

function ensurePresenceChannel() {
  if (presenceChannel) return;

  channelPresenceKey = trackedPlayerId || `anon_${Date.now()}`;
  presenceChannel = supabase.channel('app:presence', {
    config: {
      presence: {
        key: channelPresenceKey,
      },
    },
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => emitActiveCount())
    .on('presence', { event: 'join' }, () => emitActiveCount())
    .on('presence', { event: 'leave' }, () => emitActiveCount());

  presenceChannel.subscribe(async (status: string) => {
    subscribed = status === 'SUBSCRIBED';
    if (subscribed && trackedPlayerId) {
      await presenceChannel.track({
        player_id: trackedPlayerId,
        online_at: Date.now(),
      });
      emitActiveCount();
    }
  });
}

export function joinLivePresence(playerId: string) {
  if (presenceChannel && channelPresenceKey && channelPresenceKey !== playerId) {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
    channelPresenceKey = null;
    subscribed = false;
  }

  trackedPlayerId = playerId;
  ensurePresenceChannel();
  if (!presenceChannel) return;

  if (subscribed) {
    void presenceChannel.track({
      player_id: trackedPlayerId,
      online_at: Date.now(),
    });
    emitActiveCount();
  }
}

export function leaveLivePresence() {
  if (presenceChannel && subscribed) {
    void presenceChannel.untrack();
  }
}

export function subscribeActivePlayers(callback: ActiveListener): () => void {
  listeners.add(callback);
  emitActiveCount();
  return () => {
    listeners.delete(callback);
  };
}
