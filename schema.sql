-- Create the players table
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    walletAddress TEXT UNIQUE NOT NULL,
    seekerId TEXT,
    username TEXT NOT NULL,
    primaryRole TEXT,
    rating INTEGER DEFAULT 1200,
    matchesPlayed INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    createdAt BIGINT,
    lastActiveAt BIGINT
);

-- Create the dailyquests table
CREATE TABLE IF NOT EXISTS dailyquests (
    id SERIAL PRIMARY KEY,
    walletAddress TEXT REFERENCES players(walletAddress),
    type TEXT,
    title TEXT,
    description TEXT,
    target INTEGER DEFAULT 10,
    progress INTEGER DEFAULT 0,
    xpReward INTEGER DEFAULT 50,
    completed BOOLEAN DEFAULT FALSE,
    icon TEXT
);

-- Create the matches table
CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    playerA JSONB NOT NULL,
    playerB JSONB NOT NULL,
    winnerId TEXT,
    role TEXT,
    createdAt BIGINT,
    endedAt BIGINT
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_wallet ON players(walletAddress);
CREATE INDEX IF NOT EXISTS idx_matches_playerA_id ON matches ((playerA->>'id'));
CREATE INDEX IF NOT EXISTS idx_matches_playerB_id ON matches ((playerB->>'id'));
CREATE INDEX IF NOT EXISTS idx_matches_endedAt ON matches(endedAt DESC);
