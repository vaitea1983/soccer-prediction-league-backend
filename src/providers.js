import axios from "axios";
import { query } from "./db.js";

const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";
const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

export async function footballDataRequest(path) {
  if (!process.env.FOOTBALL_DATA_TOKEN) throw new Error("Missing FOOTBALL_DATA_TOKEN");
  const response = await axios.get(`${FOOTBALL_DATA_BASE}${path}`, {
    headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN }
  });
  return { quotaExceeded: false, data: response.data };
}

export async function apiFootballRequest(path, params = {}) {
  if (!process.env.API_FOOTBALL_KEY) throw new Error("Missing API_FOOTBALL_KEY");

  try {
    const response = await axios.get(`${API_FOOTBALL_BASE}${path}`, {
      headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
      params
    });

    await query(
      `INSERT INTO api_sync_status(provider, quota_exceeded, last_error, updated_at)
       VALUES('API-Football', false, null, NOW())
       ON CONFLICT(provider) DO UPDATE SET quota_exceeded=false, last_error=null, updated_at=NOW()`
    );

    return { quotaExceeded: false, data: response.data };
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

    if (status === 429 || String(message).toLowerCase().includes("quota")) {
      await query(
        `INSERT INTO api_sync_status(provider, quota_exceeded, last_error, updated_at)
         VALUES('API-Football', true, $1, NOW())
         ON CONFLICT(provider) DO UPDATE SET quota_exceeded=true, last_error=$1, updated_at=NOW()`,
        [message]
      );

      return {
        quotaExceeded: true,
        dataUnavailable: true,
        message: "data unavailable"
      };
    }

    throw error;
  }
}
