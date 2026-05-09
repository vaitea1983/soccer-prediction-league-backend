import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { query } from "../src/db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "..", "migrations");

await query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`);

const files = fs.readdirSync(migrationsDir).filter(file => file.endsWith(".sql")).sort();

for (const file of files) {
  const applied = await query(`SELECT id FROM schema_migrations WHERE id=$1`, [file]);
  if (applied.rows.length) {
    console.log(`Skipping already applied migration: ${file}`);
    continue;
  }

  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  console.log(`Applying migration: ${file}`);
  await query(sql);
  await query(`INSERT INTO schema_migrations(id) VALUES($1)`, [file]);
}

console.log("Migrations complete.");
process.exit(0);
