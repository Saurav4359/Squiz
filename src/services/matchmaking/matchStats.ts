import { supabase } from '../../config/supabase';

export async function getMatchStats(): Promise<{ active: number; sol: number; skr: number }> {
  const { data, error } = await supabase.from('match_queue').select('wager_type');

  if (error || !data) {
    console.warn('[matchStats] Failed to read match_queue:', error?.message || 'no data');
    return { active: 0, sol: 0, skr: 0 };
  }

  const sol = data.filter((x: any) => x.wager_type === 'sol').length;
  const skr = data.filter((x: any) => x.wager_type === 'skr').length;

  return {
    active: 0,
    sol,
    skr,
  };
}
