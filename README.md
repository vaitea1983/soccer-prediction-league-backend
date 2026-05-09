# Soccer Prediction League - Real Backend + Database Deployment

This package prepares the app for a real public backend/database so updates do not erase user data.

## Architecture

Recommended setup:

- Netlify: frontend app
- Render or Railway: backend API
- Supabase PostgreSQL: database
- Optional later: Supabase Storage or Cloudinary for profile pictures and badges

## Why this protects data

The frontend can be redeployed anytime without deleting users, predictions, scores, badges, or memberships because all durable data lives in PostgreSQL.

The backend uses SQL migrations. New features should add tables/columns instead of replacing existing data.

## Deployment steps

### 1. Create Supabase project

Create a new Supabase project and copy the PostgreSQL connection string.

Use the pooled or direct connection string as `DATABASE_URL`.

### 2. Deploy backend to Render

Create a new Render Web Service and upload/connect this backend folder.

Build command:

```bash
npm install && npm run migrate && npm run seed
```

Start command:

```bash
npm start
```

Required environment variables:

```text
DATABASE_URL=
JWT_SECRET=
FOOTBALL_DATA_TOKEN=
API_FOOTBALL_KEY=
FRONTEND_ORIGIN=https://soccerpredictionleague.netlify.app
APP_PUBLIC_BASE_URL=https://YOUR-BACKEND-URL.onrender.com
```

### 3. Run migrations safely

The migration system records applied migrations in `schema_migrations`.

Run:

```bash
npm run migrate
npm run seed
```

This does not erase existing data.

### 4. Connect Netlify frontend

Set the frontend API base URL to your deployed backend URL:

```js
window.SPL_API_BASE_URL = "https://YOUR-BACKEND-URL.onrender.com";
```

Then update the frontend to call the backend endpoints instead of browser-only localStorage.

## Main backend endpoints

```text
GET  /health
GET  /api/competitions
POST /api/auth/signup
POST /api/auth/signin
GET  /api/accounts/:accountId/profile
POST /api/competitions/:competitionId/join
GET  /api/competitions/:competitionId/fixtures
POST /api/predictions
POST /api/score-predictions
GET  /api/quota-status
```

## Data preserved in database

- accounts
- competition memberships
- teams
- fixtures
- predictions
- exact score predictions
- winner badges
- winner email notifications
- API quota status

## Safe update rule

Do:
- add migrations
- add columns/tables
- deploy backend after migration
- deploy frontend separately

Do not:
- drop tables
- recreate the database
- reset Supabase project
- overwrite production data with demo data


## Automatic leaderboards

Scores are calculated automatically from synced final results stored in `fixtures`.

Scoring:
- correct outcome = 3 points
- wrong outcome = 1 point
- exact score bonus = +2 points

Endpoint:
```text
GET /api/competitions/:competitionId/leaderboard
```

The frontend should not manually store leaderboard points in production. It should fetch this endpoint after final results are synced.
