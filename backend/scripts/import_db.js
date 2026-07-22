/**
 * import_db.js
 * Restores a backup folder produced by export_db.js: pg_restore's the dump
 * into the running `postgres` Docker Compose service, and copies the bundled
 * uploads/ files into backend/uploads/ so product images resolve again.
 *
 * Requires: the `postgres` Docker Compose service running, with the target
 * database reachable (a fresh empty volume is fine — --clean --if-exists
 * drops any existing objects first).
 *
 * Usage:
 *   node backend/scripts/import_db.js <path-to-backup-folder>
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const REPO_ROOT = path.join(__dirname, "..", "..");
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

const DB_USER = process.env.DB_USER || "postgres";
const DB_NAME = process.env.DB_NAME || "bos_butter";

async function restoreDatabase(dumpPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "postgres",
        "pg_restore",
        "-U",
        DB_USER,
        "-d",
        DB_NAME,
        "--clean",
        "--if-exists",
      ],
      { cwd: REPO_ROOT }
    );
    fs.createReadStream(dumpPath).pipe(child.stdin);
    child.stdout.on("data", (d) => process.stdout.write(d));
    child.stderr.on("data", (d) => process.stderr.write(d));
    child.on("error", reject);
    child.on("close", (code) => resolve(code));
  });
}

async function main() {
  const backupDir = process.argv[2];
  if (!backupDir) {
    throw new Error("Usage: node backend/scripts/import_db.js <path-to-backup-folder>");
  }

  const dumpPath = path.join(backupDir, `${DB_NAME}.dump`);
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Dump file not found: ${dumpPath}`);
  }

  process.stdout.write(`Restoring database "${DB_NAME}" from ${dumpPath}\n`);
  const code = await restoreDatabase(dumpPath);
  if (code !== 0) {
    process.stderr.write(
      `\npg_restore exited with code ${code} — check the output above for real errors ` +
        `(harmless "does not exist, skipping" notices on an empty database are expected).\n`
    );
  }

  const uploadsIn = path.join(backupDir, "uploads");
  if (fs.existsSync(uploadsIn)) {
    process.stdout.write(`Restoring uploads -> ${UPLOADS_DIR}\n`);
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.cpSync(uploadsIn, UPLOADS_DIR, { recursive: true });
  } else {
    process.stdout.write("No uploads/ folder in backup, skipping image restore.\n");
  }

  process.stdout.write(
    `\nRestore complete. Restart the app containers so in-memory caches (RAG index, etc.) ` +
      `rebuild from the restored data:\n` +
      `  docker compose restart backend auth-backend frontend\n`
  );

  if (code !== 0) process.exitCode = code;
}

main().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`);
  process.exit(1);
});
