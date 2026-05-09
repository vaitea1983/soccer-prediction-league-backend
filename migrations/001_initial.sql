CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  player_name TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  profile_picture_url TEXT,
  favorite_team_id TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Toronto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  provider TEXT NOT NULL,
  football_data_code TEXT,
  api_football_id INTEGER,
  source_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competition_memberships (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, competition_id)
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  provider_team_id TEXT,
  name TEXT NOT NULL,
  crest_url TEXT,
  current_rank INTEGER,
  last_five_form JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fixtures (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  provider_fixture_id TEXT,
  home_team_id TEXT,
  away_team_id TEXT,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  kickoff_utc TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  result TEXT CHECK(result IN ('HOME','DRAW','AWAY') OR result IS NULL),
  home_score INTEGER,
  away_score INTEGER,
  raw_payload JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixtures_competition_kickoff ON fixtures(competition_id, kickoff_utc);
CREATE INDEX IF NOT EXISTS idx_teams_competition_name ON teams(competition_id, name);

CREATE TABLE IF NOT EXISTS predictions (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  prediction TEXT NOT NULL CHECK(prediction IN ('HOME','DRAW','AWAY')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, fixture_id)
);

CREATE TABLE IF NOT EXISTS score_predictions (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  home_score INTEGER NOT NULL DEFAULT 0 CHECK(home_score >= 0),
  away_score INTEGER NOT NULL DEFAULT 0 CHECK(away_score >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, fixture_id)
);

CREATE TABLE IF NOT EXISTS winner_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  year TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  badge_svg_url TEXT,
  badge_png_url TEXT,
  released_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competition_id, year)
);

CREATE TABLE IF NOT EXISTS winner_notifications (
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  year TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ,
  email TEXT NOT NULL,
  status TEXT NOT NULL,
  response_payload JSONB,
  PRIMARY KEY (competition_id, year)
);

CREATE TABLE IF NOT EXISTS api_sync_status (
  provider TEXT PRIMARY KEY,
  quota_exceeded BOOLEAN NOT NULL DEFAULT FALSE,
  reset_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
