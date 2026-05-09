import dotenv from "dotenv";
import { query } from "../src/db.js";
import { COMPETITIONS } from "../src/competitions.js";
import { footballDataRequest, apiFootballRequest } from "../src/providers.js";

dotenv.config();

const season = Number(new Date().getUTCFullYear());

for (const c of COMPETITIONS) {
  try {
    console.log(`Syncing ${c.name} from ${c.provider}`);

    let result;
    if (c.provider === "football-data.org") {
      result = await footballDataRequest(`/competitions/${c.footballDataCode}/matches`);
      // Production normalization can be expanded here.
      console.log(`Fetched football-data.org payload for ${c.id}`);
    } else {
      result = await apiFootballRequest("/fixtures", { league: c.apiFootballId, season });
      if (result.quotaExceeded) {
        console.log(`${c.name}: data unavailable - quota exceeded`);
        continue;
      }
      console.log(`Fetched API-Football payload for ${c.id}`);
    }

    await query(
      `INSERT INTO api_sync_status(provider, quota_exceeded, last_error, updated_at)
       VALUES($1,false,null,NOW())
       ON CONFLICT(provider) DO UPDATE SET quota_exceeded=false,last_error=null,updated_at=NOW()`,
      [c.provider]
    );
  } catch (error) {
    console.error(`${c.name}: ${error.message}`);
  }
}

console.log("Sync job complete.");
process.exit(0);
