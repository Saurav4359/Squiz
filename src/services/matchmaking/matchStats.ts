import { supabase } from '../../config/supabase';

export async function getMatchStats(): Promise<{ active: number; sol: number; skr: number }> {
  const activeThreshold = Date.now() - 60000;
  const [presenceRes, queueRes] = await Promise.all([
    supabase.from('app_presence').select('player_id').gte('last_seen', activeThreshold),
    supabase.from('match_queue').select('wager_type'),
  ]);

  if (presenceRes.error || queueRes.error || !presenceRes.data || !queueRes.data) {
    console.warn(
      '[matchStats] Failed to read stats:',
      presenceRes.error?.message || queueRes.error?.message || 'no data'
    );
    return { active: 0, sol: 0, skr: 0 };
  }

  const sol = queueRes.data.filter((x: any) => x.wager_type === 'sol').length;
  const skr = queueRes.data.filter((x: any) => x.wager_type === 'skr').length;

  return {
    active: presenceRes.data.length,
    sol,
    skr,
  };
}
