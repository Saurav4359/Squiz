-- This migration adds the global SKR quests to the daily_quests table for all existing players,
-- and creates a trigger to ensure all future players also receive them.

-- 1. Insert quests for all existing players
INSERT INTO public.daily_quests (wallet_address, title, description, type, target, progress, xp_reward, token_reward, token_symbol, completed, icon)
SELECT 
    wallet_address, 
    'Road to Airdrop', 
    'Earn 10000 XP before 25th March', 
    'accuracy', 
    250, 
    LEAST(xp, 250), -- Initialize progress with their current XP
    0, 
    10, 
    'SKR', 
    (xp >= 250), 
    'airplane-outline'
FROM public.players
ON CONFLICT DO NOTHING;

INSERT INTO public.daily_quests (wallet_address, title, description, type, target, progress, xp_reward, token_reward, token_symbol, completed, icon)
SELECT 
    wallet_address, 
    'Arena Grinder', 
    'Play 5 SKR matches today', 
    'play_matches', 
    5, 
    0, -- Initialize matches today with 0
    0, 
    8, 
    'SKR', 
    false, 
    'game-controller-outline'
FROM public.players
ON CONFLICT DO NOTHING;

-- 2. Create a function to assign default quests to new players
CREATE OR REPLACE FUNCTION public.assign_default_quests()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.daily_quests (wallet_address, title, description, type, target, progress, xp_reward, token_reward, token_symbol, completed, icon)
  VALUES (NEW.wallet_address, 'Road to Airdrop', 'Earn 10000 XP before 25th March', 'accuracy', 10000, 0, 0, 10, 'SKR', false, 'airplane-outline');

  INSERT INTO public.daily_quests (wallet_address, title, description, type, target, progress, xp_reward, token_reward, token_symbol, completed, icon)
  VALUES (NEW.wallet_address, 'Arena Grinder', 'Play 5 SKR matches today', 'play_matches', 5, 0, 0, 8, 'SKR', false, 'game-controller-outline');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger to fire the function whenever a new player is created
DROP TRIGGER IF EXISTS on_player_created_assign_quests ON public.players;
CREATE TRIGGER on_player_created_assign_quests
  AFTER INSERT ON public.players
  FOR EACH ROW EXECUTE PROCEDURE public.assign_default_quests();

-- 4. Create an RPC function to easily increment quest progress from the client
CREATE OR REPLACE FUNCTION public.increment_quest_progress(
  p_wallet_address TEXT,
  p_type TEXT,
  p_amount NUMERIC
)
RETURNS void AS $$
BEGIN
  UPDATE public.daily_quests
  SET 
    progress = LEAST(progress + p_amount, target),
    completed = CASE 
                  WHEN progress + p_amount >= target THEN true 
                  ELSE completed 
                END
  WHERE wallet_address = p_wallet_address
    AND type = p_type
    AND completed = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
