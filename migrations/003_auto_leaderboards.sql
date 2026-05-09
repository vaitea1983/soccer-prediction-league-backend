CREATE OR REPLACE VIEW competition_leaderboards AS
SELECT
  cm.competition_id,
  a.id AS account_id,
  a.player_name,
  COALESCE(SUM(
    CASE
      WHEN p.fixture_id IS NULL THEN 0
      WHEN f.result IS NULL THEN 0
      WHEN p.prediction = f.result THEN 3
      ELSE 1
    END
  ), 0)
  +
  COALESCE(SUM(
    CASE
      WHEN sp.fixture_id IS NULL THEN 0
      WHEN f.home_score IS NULL OR f.away_score IS NULL THEN 0
      WHEN sp.home_score = f.home_score AND sp.away_score = f.away_score THEN 2
      ELSE 0
    END
  ), 0) AS points
FROM competition_memberships cm
JOIN accounts a ON a.id = cm.account_id
LEFT JOIN fixtures f ON f.competition_id = cm.competition_id
LEFT JOIN predictions p ON p.fixture_id = f.id AND p.account_id = a.id
LEFT JOIN score_predictions sp ON sp.fixture_id = f.id AND sp.account_id = a.id
GROUP BY cm.competition_id, a.id, a.player_name;
