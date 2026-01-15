CREATE TABLE IF NOT EXISTS trades (
    transaction_id VARCHAR(255) PRIMARY KEY,
    status_updated TIMESTAMP,
    adds JSONB,
    drops JSONB,
    draft_picks JSONB,
    price_check VARCHAR [],
    rosters JSONB,
    managers VARCHAR [],
    players VARCHAR [],
    league_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trades_adds_gin ON trades USING GIN (adds);

CREATE INDEX IF NOT EXISTS idx_trades_draft_picks_gin ON trades USING GIN (draft_picks);

CREATE INDEX IF NOT EXISTS idx_trades_status_updated ON trades (status_updated DESC);

CREATE INDEX IF NOT EXISTS idx_trades_league_id ON trades (league_id);

CREATE INDEX IF NOT EXISTS idx_trades_league_status ON trades (league_id, status_updated DESC);