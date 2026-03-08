-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Players table
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    seeker_id TEXT,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    twitter TEXT,
    rating INTEGER DEFAULT 1200,
    matches_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    xp DECIMAL DEFAULT 0,
    is_skr_staker BOOLEAN DEFAULT FALSE,
    skr_balance DECIMAL DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    created_at BIGINT,
    last_active_at BIGINT
);

-- Daily quests table
CREATE TABLE IF NOT EXISTS daily_quests (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT REFERENCES players(wallet_address),
    type TEXT,
    title TEXT,
    description TEXT,
    target INTEGER DEFAULT 10,
    progress INTEGER DEFAULT 0,
    xp_reward INTEGER DEFAULT 50,
    completed BOOLEAN DEFAULT FALSE,
    icon TEXT
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    player_a JSONB NOT NULL,
    player_b JSONB NOT NULL,
    winner_id TEXT,
    wager_lamports BIGINT DEFAULT 0,
    wager_amount BIGINT DEFAULT 0,
    wager_type TEXT DEFAULT 'sol',
    player_a_deposit_tx TEXT,
    player_b_deposit_tx TEXT,
    payout_tx TEXT,
    payout_lamports BIGINT,
    created_at BIGINT,
    ended_at BIGINT
);

CREATE TABLE IF NOT EXISTS match_queue (
    player_id TEXT PRIMARY KEY,
    wager_type TEXT NOT NULL,
    joined_at BIGINT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_players_wallet ON players(wallet_address);
CREATE INDEX IF NOT EXISTS idx_players_rating ON players(rating DESC);
CREATE INDEX IF NOT EXISTS idx_matches_ended ON matches(ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_queue_wager ON match_queue(wager_type);

-- RLS for client-side queue writes
ALTER TABLE IF EXISTS match_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'match_queue' AND policyname = 'match_queue_select_all'
    ) THEN
        CREATE POLICY match_queue_select_all ON match_queue FOR SELECT USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'match_queue' AND policyname = 'match_queue_insert_all'
    ) THEN
        CREATE POLICY match_queue_insert_all ON match_queue FOR INSERT WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'match_queue' AND policyname = 'match_queue_update_all'
    ) THEN
        CREATE POLICY match_queue_update_all ON match_queue FOR UPDATE USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'match_queue' AND policyname = 'match_queue_delete_all'
    ) THEN
        CREATE POLICY match_queue_delete_all ON match_queue FOR DELETE USING (true);
    END IF;
END $$;

-- Seed bot players for leaderboard (optional)
INSERT INTO players (wallet_address, username, rating, xp, created_at, last_active_at)
VALUES
    ('bot_SolWarrior', 'SolWarrior', 2600, 5000, extract(epoch from now()) * 1000, extract(epoch from now()) * 1000),
    ('bot_HeliusHacker', 'HeliusHacker', 2450, 4200, extract(epoch from now()) * 1000, extract(epoch from now()) * 1000),
    ('bot_TensorTitan', 'TensorTitan', 2380, 3800, extract(epoch from now()) * 1000, extract(epoch from now()) * 1000),
    ('bot_JupiterJugg', 'JupiterJuggernaut', 2100, 2500, extract(epoch from now()) * 1000, extract(epoch from now()) * 1000),
    ('bot_PhantomPilot', 'PhantomPilot', 1950, 1800, extract(epoch from now()) * 1000, extract(epoch from now()) * 1000),
    ('bot_MeteoraMind', 'MeteoraMind', 1800, 1200, extract(epoch from now()) * 1000, extract(epoch from now()) * 1000)
ON CONFLICT (wallet_address) DO NOTHING;

-- Enable Realtime for the tables that need it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'matches'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE matches;
    END IF;
END $$;
