import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query, transaction } from "./db.js";
import { createToken, requireAuth, requireSelf } from "./auth.js";
import { outcomeFromScore, validateScoreMatchesOutcome } from "./scoring.js";
import { footballDataRequest, apiFootballRequest } from "./providers.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "*",
  credentials: true
}));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "Soccer Prediction League Backend" }));

app.get("/api/competitions", async (_req, res) => {
  const { rows } = await query(
    `SELECT id, name, country, provider, source_type AS "sourceType"
     FROM competitions
     WHERE is_active = true
     ORDER BY
       CASE country
         WHEN 'France' THEN 1
         WHEN 'England' THEN 2
         WHEN 'Spain' THEN 3
         WHEN 'Germany' THEN 4
         WHEN 'Italy' THEN 5
         WHEN 'Portugal' THEN 6
         WHEN 'Europe' THEN 7
         WHEN 'International' THEN 8
         ELSE 99
       END,
       name`
  );
  res.json(rows);
});

app.post("/api/auth/signup", async (req, res) => {
  const schema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email().transform(x => x.toLowerCase()),
    playerName: z.string().min(2).max(40),
    password: z.string().min(8),
    timezone: z.string().min(1),
    competitionIds: z.array(z.string()).default([])
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const input = parsed.data;
    const passwordHash = await bcrypt.hash(input.password, 12);

    const account = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO accounts(first_name, last_name, email, player_name, password_hash, timezone)
         VALUES($1,$2,$3,$4,$5,$6)
         RETURNING id, player_name, timezone`,
        [input.firstName, input.lastName, input.email, input.playerName, passwordHash, input.timezone]
      );

      for (const competitionId of input.competitionIds) {
        await client.query(
          `INSERT INTO competition_memberships(account_id, competition_id)
           VALUES($1,$2)
           ON CONFLICT DO NOTHING`,
          [result.rows[0].id, competitionId]
        );
      }

      return result.rows[0];
    });

    res.status(201).json({ token: createToken(account), account });
  } catch (error) {
    res.status(409).json({ error: "Email or player name already exists." });
  }
});

app.post("/api/auth/signin", async (req, res) => {
  const schema = z.object({
    email: z.string().email().transform(x => x.toLowerCase()),
    password: z.string().min(1)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { rows } = await query(
    `SELECT id, email, player_name, password_hash, timezone
     FROM accounts
     WHERE email=$1`,
    [parsed.data.email]
  );

  const account = rows[0];
  if (!account) return res.status(401).json({ error: "Invalid email or password." });

  const ok = await bcrypt.compare(parsed.data.password, account.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid email or password." });

  res.json({
    token: createToken(account),
    account: { id: account.id, playerName: account.player_name, timezone: account.timezone }
  });
});

app.get("/api/accounts/:accountId/profile", requireAuth, requireSelf, async (req, res) => {
  const account = await query(
    `SELECT id, player_name AS "playerName", profile_picture_url AS "profilePictureUrl",
            favorite_team_id AS "favoriteTeamId", timezone, created_at AS "createdAt"
     FROM accounts WHERE id=$1`,
    [req.params.accountId]
  );

  if (!account.rows[0]) return res.status(404).json({ error: "Unknown account." });

  const memberships = await query(
    `SELECT c.id AS "competitionId", c.name AS "competitionName", cm.joined_at AS "joinedAt"
     FROM competition_memberships cm
     JOIN competitions c ON c.id = cm.competition_id
     WHERE cm.account_id=$1
     ORDER BY c.country, c.name`,
    [req.params.accountId]
  );

  const badges = await query(
    `SELECT wb.id, wb.competition_id AS "competitionId", c.name AS "competitionName",
            wb.year, wb.badge_svg_url AS "badgeSvgUrl", wb.badge_png_url AS "badgePngUrl", wb.released_at AS "releasedAt"
     FROM winner_badges wb
     JOIN competitions c ON c.id = wb.competition_id
     WHERE wb.account_id=$1
     ORDER BY wb.released_at DESC`,
    [req.params.accountId]
  );

  res.json({ ...account.rows[0], memberships: memberships.rows, badges: badges.rows });
});

app.post("/api/competitions/:competitionId/join", requireAuth, async (req, res) => {
  await query(
    `INSERT INTO competition_memberships(account_id, competition_id)
     VALUES($1,$2)
     ON CONFLICT DO NOTHING`,
    [req.auth.sub, req.params.competitionId]
  );
  res.status(201).json({ accountId: req.auth.sub, competitionId: req.params.competitionId });
});

app.get("/api/competitions/:competitionId/fixtures", async (req, res) => {
  const { rows } = await query(
    `SELECT id, competition_id AS "competitionId", home_team_name AS "homeTeamName",
            away_team_name AS "awayTeamName", kickoff_utc AS "kickoffUtc",
            status, result, home_score AS "homeScore", away_score AS "awayScore"
     FROM fixtures
     WHERE competition_id=$1
     ORDER BY kickoff_utc ASC`,
    [req.params.competitionId]
  );

  res.json(rows);
});

app.post("/api/predictions", requireAuth, async (req, res) => {
  const schema = z.object({
    fixtureId: z.string().min(1),
    prediction: z.enum(["HOME","DRAW","AWAY"])
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  await query(
    `INSERT INTO predictions(account_id, fixture_id, prediction, updated_at)
     VALUES($1,$2,$3,NOW())
     ON CONFLICT(account_id, fixture_id)
     DO UPDATE SET prediction=excluded.prediction, updated_at=NOW()`,
    [req.auth.sub, parsed.data.fixtureId, parsed.data.prediction]
  );

  res.status(201).json({ accountId: req.auth.sub, ...parsed.data });
});

app.post("/api/score-predictions", requireAuth, async (req, res) => {
  const schema = z.object({
    fixtureId: z.string().min(1),
    homeScore: z.number().int().min(0).default(0),
    awayScore: z.number().int().min(0).default(0)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await query(
    `SELECT prediction FROM predictions WHERE account_id=$1 AND fixture_id=$2`,
    [req.auth.sub, parsed.data.fixtureId]
  );

  const selectedOutcome = existing.rows[0]?.prediction;
  if (!selectedOutcome) return res.status(400).json({ error: "Choose the match outcome first." });

  if (!validateScoreMatchesOutcome(selectedOutcome, parsed.data)) {
    return res.status(400).json({ error: "Score prediction does not match selected outcome." });
  }

  await query(
    `INSERT INTO score_predictions(account_id, fixture_id, home_score, away_score, updated_at)
     VALUES($1,$2,$3,$4,NOW())
     ON CONFLICT(account_id, fixture_id)
     DO UPDATE SET home_score=excluded.home_score, away_score=excluded.away_score, updated_at=NOW()`,
    [req.auth.sub, parsed.data.fixtureId, parsed.data.homeScore, parsed.data.awayScore]
  );

  res.status(201).json({ accountId: req.auth.sub, ...parsed.data });
});


app.get("/api/competitions/:competitionId/leaderboard", async (req, res) => {
  const { rows } = await query(
    `SELECT
       a.id AS "accountId",
       a.player_name AS "playerName",
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
       ), 0) AS points,
       COUNT(p.fixture_id) FILTER (WHERE f.result IS NOT NULL) AS "predictionsCount",
       COUNT(p.fixture_id) FILTER (WHERE p.prediction = f.result) AS "correctOutcomes",
       COUNT(sp.fixture_id) FILTER (WHERE sp.home_score = f.home_score AND sp.away_score = f.away_score) AS "exactScores"
     FROM competition_memberships cm
     JOIN accounts a ON a.id = cm.account_id
     LEFT JOIN fixtures f ON f.competition_id = cm.competition_id
     LEFT JOIN predictions p ON p.fixture_id = f.id AND p.account_id = a.id
     LEFT JOIN score_predictions sp ON sp.fixture_id = f.id AND sp.account_id = a.id
     WHERE cm.competition_id = $1
     GROUP BY a.id, a.player_name
     ORDER BY points DESC, "correctOutcomes" DESC, a.player_name ASC`,
    [req.params.competitionId]
  );

  const fixtureCounts = await query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE result IS NOT NULL AND status='FINISHED') AS finalized
     FROM fixtures
     WHERE competition_id=$1`,
    [req.params.competitionId]
  );

  res.json({
    competitionId: req.params.competitionId,
    scoring: {
      correctOutcome: 3,
      wrongOutcome: 1,
      exactScoreBonus: 2
    },
    fixtures: {
      total: Number(fixtureCounts.rows[0]?.total || 0),
      finalized: Number(fixtureCounts.rows[0]?.finalized || 0)
    },
    leaderboard: rows.map(row => ({
      ...row,
      points: Number(row.points || 0),
      predictionsCount: Number(row.predictionsCount || 0),
      correctOutcomes: Number(row.correctOutcomes || 0),
      exactScores: Number(row.exactScores || 0)
    }))
  });
});

app.get("/api/quota-status", async (_req, res) => {
  const { rows } = await query(`SELECT * FROM api_sync_status ORDER BY provider`);
  res.json(rows);
});

app.listen(port, () => console.log(`Soccer Prediction League backend running on port ${port}`));
