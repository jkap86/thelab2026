CREATE TABLE IF NOT EXISTS leagues (
    league_id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    avatar VARCHAR(255),
    season VARCHAR(255),
    settings JSONB,
    scoring_settings JSONB,
    roster_positions JSONB,
    rosters JSONB,
    status VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leagues_settings_type ON leagues ((settings ->> 'type'));

CREATE INDEX IF NOT EXISTS idx_leagues_settings_best_ball ON leagues ((settings ->> 'best_ball'));