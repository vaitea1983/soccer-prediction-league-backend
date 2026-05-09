import dotenv from "dotenv";
import { query } from "../src/db.js";
import { COMPETITIONS } from "../src/competitions.js";

dotenv.config();

for (const c of COMPETITIONS) {
  await query(
    `INSERT INTO competitions(id, name, country, provider, football_data_code, api_football_id, source_type, updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,NOW())
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       country=excluded.country,
       provider=excluded.provider,
       football_data_code=excluded.football_data_code,
       api_football_id=excluded.api_football_id,
       source_type=excluded.source_type,
       updated_at=NOW()`,
    [c.id, c.name, c.country, c.provider, c.footballDataCode, c.apiFootballId, c.sourceType]
  );
}

console.log("Competition seed complete.");
process.exit(0);
