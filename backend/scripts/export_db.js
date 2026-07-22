/**
 * export_db.js
 * Dumps the live Postgres database (running in the `postgres` Docker Compose
 * service) plus the backend/uploads/ image files into one timestamped backup
 * folder under backend/db_backups/, so both can be carried to another machine
 * together (USB drive, cloud folder, etc.) and restored with import_db.js.
 *
 * pg_dump only captures database rows (e.g. the image_url text) — it never
 * touches files on disk, so the uploads/ folder is copied separately here.
 *
 * Requires: the `postgres` Docker Compose service running.
 *
 * Usage:
 *   node backend/scripts/export_db.js
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const REPO_ROOT = path.join(__dirname, "..", "..");
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const BACKUPS_ROOT = path.join(__dirname, "..", "db_backups");

const DB_USER = process.env.DB_USER || "postgres";
const DB_NAME = process.env.DB_NAME || "bos_butter";

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function dumpDatabase(dumpPath) {
  await new Promise((resolve, reject) => {
    const dumpStream = fs.createWriteStream(dumpPath);
    const child = spawn(
      "docker",
      ["compose", "exec", "-T", "postgres", "pg_dump", "-U", DB_USER, "-d", DB_NAME, "-Fc"],
      { cwd: REPO_ROOT }
    );
    child.stdout.pipe(dumpStream);
    child.stderr.on("data", (d) => process.stderr.write(d));
    child.on("error", reject);
    child.on("close", (code) => {
      dumpStream.close();
      if (code === 0) resolve();
      else reject(new Error(`pg_dump exited with code ${code}`));
    });
  });
}

async function main() {
  const stamp = timestamp();
  const outDir = path.join(BACKUPS_ROOT, stamp);
  fs.mkdirSync(outDir, { recursive: true });

  const dumpPath = path.join(outDir, `${DB_NAME}.dump`);
  process.stdout.write(`Dumping database "${DB_NAME}" -> ${dumpPath}\n`);
  await dumpDatabase(dumpPath);

  const uploadsOut = path.join(outDir, "uploads");
  if (fs.existsSync(UPLOADS_DIR)) {
    process.stdout.write(`Copying uploads -> ${uploadsOut}\n`);
    fs.cpSync(UPLOADS_DIR, uploadsOut, { recursive: true });
  } else {
    process.stdout.write("No backend/uploads/ folder found, skipping image copy.\n");
  }

  process.stdout.write(
    `\nBackup complete: ${outDir}\n` +
      `Copy this ENTIRE folder (dump + uploads) to the other machine, then run:\n` +
      `  node backend/scripts/import_db.js "<path-to-this-folder>"\n`
  );
}

main().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`);
  process.exit(1);
});
